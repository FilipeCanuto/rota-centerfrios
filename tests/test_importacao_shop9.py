"""Importação Shop9: regressão autenticada com fixtures temporárias."""
import os,secrets,unittest,uuid
from pathlib import Path
import requests
D,V,ADM=str(uuid.uuid4()),str(uuid.uuid4()),str(uuid.uuid4()); TAG='IMPT'+uuid.uuid4().hex[:6]
class Importacao(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.svc={'apikey':key,'Content-Type':'application/json'}
  if not key.startswith('sb_'): cls.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.auth=[]; cls.h={}; cls.addClassCleanup(cls.cleanup)
  cls.emp=emp=cls.get('empresas',{'nome':'eq.CENTERFRIOS'})[0]['id']
  for uid,n,role in [(D,'dir','diretoria'),(V,'vend','vendedor'),(ADM,'adm','administrador')]:
   cls.ins('usuarios',{'id':uid,'nome':'Imp '+n,'email':f'imp.{n}.teste@centerfrios.com','empresa_id':emp})
   cls.ins('usuario_empresas',{'usuario_id':uid,'empresa_id':emp}); cls.ins('papeis_pre_cadastro',{'usuario_id':uid,'role':role,'empresa_id':emp})
   pw=secrets.token_urlsafe(32); email=f'imp.{n}.teste@centerfrios.com'
   r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.svc,json={'email':email,'password':pw,'email_confirm':True},timeout=30); r.raise_for_status(); cls.auth.append(r.json()['id'])
   r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.pub,json={'email':email,'password':pw},timeout=30); r.raise_for_status()
   cls.h[uid]={**cls.pub,'Authorization':'Bearer '+r.json()['access_token'],'Content-Type':'application/json'}
 @classmethod
 def get(cls,t,p): r=requests.get(cls.url+'/rest/v1/'+t,headers=cls.svc,params=p,timeout=30); r.raise_for_status(); return r.json()
 @classmethod
 def ins(cls,t,d): r=requests.post(cls.url+'/rest/v1/'+t,headers=cls.svc,json=d,timeout=30); assert r.ok,r.text
 @classmethod
 def cleanup(cls):
  d=lambda t,p: requests.delete(cls.url+'/rest/v1/'+t,headers=cls.svc,params=p,timeout=30)
  cl=[c['id'] for c in cls.get('clientes',{'codigo_shop9':f'like.{TAG}*','select':'id'})] or [str(uuid.uuid4())]
  for t in ['itens_venda','orcamentos','vendas']: d(t,{'cliente_id':'in.('+','.join(cl)+')'})
  d('clientes',{'id':'in.('+','.join(cl)+')'}); d('importacoes',{'usuario_id':f'in.({D})'})
  for uid in cls.auth: requests.delete(cls.url+'/auth/v1/admin/users/'+uid,headers=cls.svc,timeout=30)
  d('user_roles',{'user_id':'in.('+','.join(cls.auth or [str(uuid.uuid4())])+')'})
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('registro_auditoria','vendedor_id'),('registro_auditoria','usuario_id'),('usuarios','id')]: d(t,{f:f'in.({D},{V},{ADM})'})
 def rpc(self,who,fn,linhas): return requests.post(self.url+'/rest/v1/rpc/'+fn,headers=self.h[who],json={'_empresa_id':self.emp,'_arquivo':TAG+'.xlsx','_linhas':linhas},timeout=60)
 CLIENTES=[{'linha':2,'codigo_shop9':TAG+'1','nome':'Padaria Imp','documento':'12.345.678/0001-90','vendedor_email':'imp.vend.teste@centerfrios.com'},
  {'linha':3,'codigo_shop9':TAG+'2','nome':'Açougue Imp','vendedor_email':'IMP.VEND.TESTE@centerfrios.com'},
  {'linha':4,'codigo_shop9':TAG+'3','nome':'Sem dono','vendedor_email':'ninguem@centerfrios.com'}]
 def test_1_clientes(self):
  r=self.rpc(D,'importar_clientes',self.CLIENTES); self.assertTrue(r.ok,r.text); j=r.json(); print('1:',j)
  self.assertEqual((j['inseridas'],j['atualizadas'],j['ignoradas']),(2,0,1)); self.assertEqual(j['erros'][0]['linha'],4)
  r=self.rpc(D,'importar_clientes',self.CLIENTES); j=r.json(); print('2:',j)
  self.assertEqual((j['inseridas'],j['atualizadas']),(0,2)); self.assertEqual(len(self.get('clientes',{'codigo_shop9':f'like.{TAG}*'})),2)
 def test_2_vendas_orcamentos(self):
  r=self.rpc(D,'importar_vendas',[{'linha':2,'codigo_shop9':TAG+'NF1','cliente_codigo':TAG+'1','data_faturamento':'2026-11-09','valor':750,'itens':[{'produto':'Freezer','quantidade':1,'valor_total':700},{'produto':'Gelo','quantidade':5,'valor_total':50}]},
   {'linha':3,'codigo_shop9':TAG+'NF2','cliente_codigo':'NAOEXISTE','data_faturamento':'2026-11-09','valor':10}]); self.assertTrue(r.ok,r.text); j=r.json(); print('3:',j)
  self.assertEqual((j['inseridas'],j['ignoradas']),(1,1))
  v=self.get('vendas',{'codigo_shop9':f'eq.{TAG}NF1','select':'id,vendedor_id'}); self.assertEqual(v[0]['vendedor_id'],V)
  self.assertEqual(len(self.get('itens_venda',{'venda_id':'eq.'+v[0]['id']})),2)
  self.assertEqual(self.get('clientes',{'codigo_shop9':f'eq.{TAG}1'})[0]['data_ultima_compra'],'2026-11-09')
  o=[{'linha':2,'codigo_shop9':TAG+'O1','cliente_codigo':TAG+'1','data':'2026-11-08','valor':900,'status':'aberto'}]
  self.assertEqual(self.rpc(D,'importar_orcamentos',o).json()['inseridas'],1)
  requests.patch(self.url+'/rest/v1/orcamentos',headers=self.svc,params={'codigo_shop9':f'eq.{TAG}O1'},json={'observacao':'ligar'},timeout=30)
  o[0]['status']='ganho'; self.assertEqual(self.rpc(D,'importar_orcamentos',o).json()['atualizadas'],1)
  x=self.get('orcamentos',{'codigo_shop9':f'eq.{TAG}O1'})[0]; self.assertEqual((x['status'],x['observacao']),('ganho','ligar'))
 def test_3_recusa(self):
  for who in [V,ADM]:
   for fn in ['importar_clientes','importar_vendas','importar_orcamentos']:
    r=self.rpc(who,fn,[]); self.assertEqual(r.status_code,403,r.text)
  print('4: vendedor/administrador recusados')
 def test_4_registros(self):
  imp=requests.get(self.url+'/rest/v1/importacoes',headers=self.h[D],params={'arquivo':f'eq.{TAG}.xlsx'},timeout=30).json()
  self.assertGreaterEqual(len(imp),5)
  aud=self.get('registro_auditoria',{'usuario_id':'eq.'+D,'acao':'like.importacao_*'}); self.assertEqual(len(aud),len(imp))
  self.assertEqual(requests.get(self.url+'/rest/v1/importacoes',headers=self.h[V],timeout=30).json(),[])
  print('5:',len(imp),'lotes e',len(aud),'auditorias')
if __name__=='__main__': unittest.main()
