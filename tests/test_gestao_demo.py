"""Live authenticated demo lifecycle regression; invitations provisioned by data tools."""
import datetime,json,os,secrets,unittest
from pathlib import Path
from zoneinfo import ZoneInfo
import requests

SELLERS=['830d3560-06b0-4506-b40c-6ba424e34ce0','00b31584-f79e-4e93-9a14-96f308eed4f4']
TABLES=['clientes','vendas','interacoes','metas','configuracoes_regras','empresas','feriados','usuarios']
DEMO_TABLES=['interacoes','vendas','orcamentos','tarefas_agenda','alertas','pontos','selos','metas','links','clientes','equipes','usuarios','empresas']
class Demo(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.service={'apikey':key}
  if not key.startswith('sb_'): cls.service['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.public={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.accounts={}; cls.addClassCleanup(cls.cleanup)
  for role in ['admin','vendedor']:
   email='demo.'+role+'.teste@centerfrios.com'; password=secrets.token_urlsafe(32)
   r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.service,json={'email':email,'password':password,'email_confirm':True},timeout=30)
   if not r.ok: raise RuntimeError('Não foi possível criar a conta temporária')
   cls.accounts[role]={'id':r.json()['id']}
   r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.public,json={'email':email,'password':password},timeout=30)
   if not r.ok: raise RuntimeError('Não foi possível autenticar a conta temporária')
   cls.accounts[role]['headers']={**cls.public,'Authorization':'Bearer '+r.json()['access_token']}
  cls.results=[]; cls.today=datetime.datetime.now(ZoneInfo('America/Maceio')).date()
 @classmethod
 def cleanup(cls):
  for account in cls.accounts.values():
   r=requests.delete(cls.url+'/auth/v1/admin/users/'+account['id'],headers=cls.service,timeout=30)
   if not r.ok: raise RuntimeError('Não foi possível remover a conta temporária')
  Path('/tmp/demo/results.json').write_text(json.dumps(cls.results,ensure_ascii=False,indent=2))
 def rows(self,table,params=None):
  r=requests.get(self.url+'/rest/v1/'+table,headers=self.service,params=params,timeout=30)
  self.assertTrue(r.ok,r.text[:500]); return r.json()
 def rpc(self,fn,body=None,role='admin'):
  return requests.post(self.url+'/rest/v1/rpc/'+fn,headers=self.accounts[role]['headers'],json=body or {},timeout=60)
 def success(self,r): self.assertTrue(r.ok,r.text[:500]); return r.json()
 def counts(self):
  return {t:len(self.rows(t,{'demo':'eq.false'} if t not in ['feriados','configuracoes_regras'] else None)) for t in TABLES}
 def identities(self):
  users=self.rows('usuarios',{'id':'in.('+','.join(SELLERS)+')'}); auth=[u['auth_user_id'] for u in users]
  return {'users':[(u['id'],u['auth_user_id'],u['nome']) for u in users], 'roles':self.rows('user_roles',{'user_id':'in.('+','.join(auth)+')','order':'id'}),'memberships':self.rows('usuario_empresas',{'usuario_id':'in.('+','.join(SELLERS)+')','order':'usuario_id,empresa_id'})}
 def test_01_empresas_reais(self):
  rows=self.rows('empresas'); self.assertEqual(len(rows),2); self.assertTrue(all(not r['demo'] for r in rows))
 def test_02_limpeza_preserva(self):
  before=self.counts(); identities=self.identities(); converted=len(self.rows('usuarios',{'demo':'eq.true','auth_user_id':'not.is.null'}))
  summary=self.success(self.rpc('apagar_dados_demo')); after=self.counts()
  expected={**before,'usuarios':before['usuarios']+converted}; self.assertEqual(after,expected)
  self.assertEqual(self.identities(),identities)
  for t in DEMO_TABLES: self.assertEqual(self.rows(t,{'demo':'eq.true'}),[],t)
  self.assertEqual(set(summary),set(DEMO_TABLES)-{'empresas'}|{'usuario_empresas','papeis_pre_cadastro'})
  self.results.append({'before':before,'after':after,'converted_users':converted,'summary':summary,'accounts_preserved':True})
 def test_03_recria_contas_reais(self):
  self.assertEqual(self.success(self.rpc('carregar_dados_demo',{'_vendedores':SELLERS})),{'clientes':60,'vendedores':2,'empresas':2})
  rows=self.rows('clientes',{'demo':'eq.true'}); self.assertEqual(len(rows),60)
  self.assertEqual({r['cidade'] for r in rows},{'Maceió','Arapiraca','Rio Largo','Marechal Deodoro','Palmeira dos Índios','São Miguel dos Campos'})
  self.assertTrue(all(r['telefone'].startswith('5582') for r in rows))
  sales=self.rows('vendas',{'demo':'eq.true'}); counts={r['id']:sum(s['cliente_id']==r['id'] for s in sales) for r in rows}
  self.assertEqual(sum(v==2 for v in counts.values()),2); self.assertEqual(sum(v==0 for v in counts.values()),2)
  interactions=self.rows('interacoes',{'demo':'eq.true'})
  recent=[c for c in rows if c['data_ultima_compra']==(self.today-datetime.timedelta(days=1)).isoformat() and not any(i['cliente_id']==c['id'] for i in interactions)]
  self.assertEqual(len(recent),1)
  local=[datetime.datetime.fromisoformat(i['data']).astimezone(ZoneInfo('America/Maceio')) for i in interactions if i['cliente_respondeu']]
  self.assertTrue(any(d.date()==self.today-datetime.timedelta(days=1) and d.hour==23 and d.minute==30 for d in local))
  budgets=self.rows('orcamentos',{'demo':'eq.true'}); self.assertTrue(any(datetime.date.fromisoformat(b['ultimo_followup']).weekday()==4 for b in budgets))
  targets=self.rows('metas',{'demo':'eq.true'}); self.assertEqual(len(targets),4); self.assertTrue(all(t['mes']==self.today.replace(day=1).isoformat() for t in targets))
  self.assertTrue(all(not u['demo'] for u in self.rows('usuarios',{'id':'in.('+','.join(SELLERS)+')'})))
 def test_04_recusa_duplicacao(self):
  r=self.rpc('carregar_dados_demo',{'_vendedores':SELLERS}); self.assertFalse(r.ok); self.assertEqual(r.json()['message'],'Já existem dados de demonstração.')
 def test_05_feriados_idempotentes(self):
  self.assertEqual(self.success(self.rpc('carregar_feriados_nacionais')),0); self.assertEqual(len(self.rows('feriados')),20)
 def test_06_vendedor_recusado(self):
  for fn in ['apagar_dados_demo','carregar_dados_demo','carregar_feriados_nacionais']:
   r=self.rpc(fn,role='vendedor'); self.assertEqual(r.status_code,403); self.assertEqual(r.json()['code'],'42501')
 def test_07_auditoria_resumo(self):
  rows=self.rows('registro_auditoria',{'acao':'eq.apagar_dados_demo'}); self.assertTrue(rows)
  self.assertTrue(any(r['detalhes']==self.results[0]['summary'] and r['usuario_id']=='55555555-5555-4555-8555-555555555101' for r in rows))
 def test_08_ficticios_limpos_e_demo_final(self):
  identities=self.identities(); self.success(self.rpc('apagar_dados_demo'))
  self.success(self.rpc('carregar_dados_demo')); users=self.rows('usuarios',{'demo':'eq.true'})
  self.assertEqual({u['nome'] for u in users},{'Humberto Demo','Clara Demo','Supervisor Demo'}); self.assertTrue(all(u['auth_user_id'] is None for u in users))
  summary=self.success(self.rpc('apagar_dados_demo')); self.assertEqual(summary['usuarios'],3); self.assertEqual(summary['equipes'],1)
  self.assertEqual(summary['papeis_pre_cadastro'],3); self.assertEqual(summary['usuario_empresas'],6)
  self.assertEqual(self.rows('usuarios',{'demo':'eq.true'}),[]); self.assertEqual(self.identities(),identities)
  self.success(self.rpc('carregar_dados_demo',{'_vendedores':SELLERS})); self.results.append({'final_demo_clients':60,'fictitious_cleanup':summary})
if __name__=='__main__': unittest.main()