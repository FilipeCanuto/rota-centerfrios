"""Live authenticated checks; public fixtures are provisioned/removed by data tools."""
import json,os,secrets,unittest
from pathlib import Path
import requests
CF='49ddeee5-cbe2-4bf0-a53b-f5f7ef3e31b1'
def fid(n): return '22222222-2222-4222-8222-222222222'+str(n)
class Remanejamento(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; k=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.service={'apikey':k}
  if not k.startswith('sb_'): cls.service['Authorization']='Bearer '+k
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.public={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.accounts={}; cls.report=[]
  cls.addClassCleanup(cls.cleanup)
  for n,role in enumerate(['vendedora','vendedorb','supervisor','outrosupervisor','diretoria','administrador'],101):
   email='remanejamento.'+role+'@centerfrios.com'; password=secrets.token_urlsafe(32)
   r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.service,json={'email':email,'password':password,'email_confirm':True},timeout=30)
   if not r.ok: raise RuntimeError('Falha ao criar conta de teste: '+str(r.status_code))
   cls.accounts[role]={'id':r.json()['id'],'usuario':fid(n)}
   r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.public,json={'email':email,'password':password},timeout=30)
   if not r.ok: raise RuntimeError('Falha ao entrar: '+str(r.status_code))
   cls.accounts[role]['headers']={**cls.public,'Authorization':'Bearer '+r.json()['access_token'],'Prefer':'return=representation'}
 @classmethod
 def cleanup(cls):
  for a in cls.accounts.values():
   r=requests.delete(cls.url+'/auth/v1/admin/users/'+a['id'],headers=cls.service,timeout=30)
   if not r.ok: raise RuntimeError('Falha ao apagar conta de teste')
  Path('/tmp/remanejamento/results.json').write_text(json.dumps(cls.report,ensure_ascii=False,indent=2))
  print('Seis contas temporárias de autenticação apagadas.')
 def api(self,role,method,table,body=None,params=None):
  return requests.request(method,self.url+'/rest/v1/'+table,headers=self.accounts[role]['headers'],json=body,params=params,timeout=30)
 def rpc(self,role,client=121,motive='Redistribuição teste',seller=102):
  return self.api(role,'POST','rpc/remanejar_cliente',{'_cliente_id':fid(client),'_novo_vendedor_id':fid(seller),'_motivo':motive})
 def ok(self,r): self.assertTrue(r.ok,r.text[:500]); return r.json() if r.content else None
 def denied(self,r): self.assertEqual(r.status_code,403,r.text[:500]); self.assertEqual(r.json()['code'],'42501')
 def note(self,n,result): self.report.append({'cenario':n,'resultado':result}); print(n,result)
 def test_01_vendedor_recusado(self): self.denied(self.rpc('vendedora')); self.note(1,'Vendedor recusado 42501')
 def test_02_compra_recente(self):
  r=self.rpc('supervisor',120); self.assertEqual(r.status_code,400)
  self.assertEqual(r.json()['message'],'Este cliente comprou há menos de 90 dias e ainda não pode mudar de carteira.')
  self.note(2,r.json()['message'])
 def test_03_troca_auditada(self):
  self.ok(self.rpc('supervisor'))
  row=self.ok(self.api('diretoria','GET','clientes',params={'id':'eq.'+fid(121)}))[0]; self.assertEqual(row['vendedor_id'],fid(102))
  rows=self.ok(self.api('diretoria','GET','registro_auditoria',params={'registro_id':'eq.'+fid(121),'acao':'eq.remanejamento'}))
  self.assertEqual(len(rows),1); row=rows[0]
  self.assertEqual(row['usuario_id'],fid(103)); self.assertEqual(row['vendedor_id'],fid(101))
  self.assertEqual(row['detalhes']['motivo'],'Redistribuição teste'); self.assertEqual(row['detalhes']['dias_sem_compra'],95)
  self.assertEqual(row['detalhes']['antigo']['vendedor_id'],fid(101)); self.assertEqual(row['detalhes']['novo']['vendedor_id'],fid(102))
  self.note(3,'Sucesso; uma auditoria, motivo Redistribuição teste e 95 dias')
 def test_04_outra_equipe(self): self.denied(self.rpc('outrosupervisor',seller=101)); self.note(4,'Outra equipe recusada 42501')
 def test_05_update_direto(self):
  rows=self.ok(self.api('diretoria','PATCH','clientes',{'vendedor_id':fid(101)},{'id':'eq.'+fid(121)})); self.assertEqual(rows,[])
  self.note(5,'UPDATE direto bloqueado antes do gatilho pela RLS: 0 linhas')
 def test_06_auditoria_nao_falsificavel(self):
  for role in self.accounts:
   self.denied(self.api(role,'POST','registro_auditoria',{'acao':'falsa','tabela':'clientes','usuario_id':self.accounts[role]['usuario']}))
   self.denied(self.api(role,'POST','rpc/auditar',{'_acao':'falsa','_tabela':'clientes','_registro':fid(121),'_empresa':CF,'_vendedor':fid(101),'_detalhes':{}}))
  self.note(6,'INSERT e auditar recusados para todos os seis usuários')
 def test_07_meta_auditada(self):
  rows=self.ok(self.api('diretoria','PATCH','metas',{'meta_vendas':456},{'id':'eq.'+fid(130)})); self.assertEqual(rows[0]['meta_vendas'],456)
  rows=self.ok(self.api('diretoria','GET','registro_auditoria',params={'registro_id':'eq.'+fid(130),'acao':'eq.alteracao_meta'}))
  updates=[r for r in rows if r['detalhes']['operacao']=='UPDATE']; self.assertEqual(len(updates),1)
  self.assertEqual(updates[0]['detalhes']['antigo']['meta_vendas'],123); self.assertEqual(updates[0]['detalhes']['novo']['meta_vendas'],456)
  self.note(7,'alteracao_meta: antigo 123, novo 456')
 def test_08_admin_tecnico(self):
  rows=self.ok(self.api('administrador','GET','registro_auditoria',params={'acao':'eq.alteracao_permissao','vendedor_id':'eq.'+fid(101)})); self.assertGreater(len(rows),0)
  rows=self.ok(self.api('administrador','GET','registro_auditoria',params={'acao':'eq.remanejamento','registro_id':'eq.'+fid(121)})); self.assertEqual(rows,[])
  self.note(8,'Administrador lê permissões, mas não remanejamento')
 def test_09_supervisor_empresa(self):
  rows=self.ok(self.api('supervisor','GET','clientes',params={'select':'id,empresa_id','id':'in.('+fid(120)+','+fid(121)+')'}))
  self.assertEqual(len(rows),2); self.assertTrue(all(r['empresa_id']==CF for r in rows))
  rows=self.ok(self.api('supervisor','GET','registro_auditoria',params={'registro_id':'eq.'+fid(121),'acao':'eq.remanejamento'})); self.assertEqual(len(rows),1)
  self.note(9,'Supervisor com papel somente CENTERFRIOS vê os dois clientes e a auditoria da equipe')
 def test_10_motivo_minimo(self):
  r=self.rpc('diretoria',motive='abcd'); self.assertEqual(r.status_code,400); self.assertIn('5 caracteres',r.json()['message'])
 def test_11_sem_alterar_auditoria(self):
  for role in self.accounts:
   self.denied(self.api(role,'PATCH','registro_auditoria',{'acao':'falsa'},{'registro_id':'eq.'+fid(121)}))
   self.denied(self.api(role,'DELETE','registro_auditoria',params={'registro_id':'eq.'+fid(121)}))
if __name__=='__main__': unittest.main()
