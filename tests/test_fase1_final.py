"""Painel da gestão, copiloto, notificações, demo completa e cobertura por compra."""
import os,secrets,unittest,uuid
from pathlib import Path
import requests
A,B,D,C=(str(uuid.uuid4()) for _ in range(4)); DIA='2026-11-11'
class Fase1(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.svc={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'}
  if not key.startswith('sb_'): cls.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.auth=[]; cls.h={}; cls.addClassCleanup(cls.cleanup)
  cls.emp=emp=cls.get('empresas',{'nome':'eq.CENTERFRIOS'})[0]['id']
  for uid,n,role,e in [(A,'a','vendedor',emp),(B,'b','vendedor',emp),(D,'d','diretoria',None)]:
   cls.ins('usuarios',{'id':uid,'nome':'F1 '+n,'email':f'f1.{n}.teste@centerfrios.com','empresa_id':emp})
   cls.ins('usuario_empresas',{'usuario_id':uid,'empresa_id':emp}); cls.ins('papeis_pre_cadastro',{'usuario_id':uid,'role':role,'empresa_id':e})
  cls.ins('clientes',{'id':C,'empresa_id':emp,'vendedor_id':A,'nome':'Cliente F1'})
  cls.ins('metas',{'empresa_id':emp,'vendedor_id':A,'mes':'2026-11-01','meta_vendas':0,'meta_orcamentos':0,'meta_cobertura':100,'meta_reativacao':0})
  cls.ins('vendas',{'empresa_id':emp,'vendedor_id':A,'cliente_id':C,'data_faturamento':DIA,'valor':500})
  for uid,n in [(A,'a'),(B,'b'),(D,'d')]:
   email=f'f1.{n}.teste@centerfrios.com'; pw=secrets.token_urlsafe(32)
   r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.svc,json={'email':email,'password':pw,'email_confirm':True},timeout=30); r.raise_for_status(); cls.auth.append(r.json()['id'])
   r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.pub,json={'email':email,'password':pw},timeout=30); r.raise_for_status()
   cls.h[uid]={**cls.pub,'Authorization':'Bearer '+r.json()['access_token'],'Content-Type':'application/json','Prefer':'return=representation'}
 @classmethod
 def get(cls,t,p): r=requests.get(cls.url+'/rest/v1/'+t,headers=cls.svc,params=p,timeout=30); r.raise_for_status(); return r.json()
 @classmethod
 def ins(cls,t,d): r=requests.post(cls.url+'/rest/v1/'+t,headers=cls.svc,json=d,timeout=30); assert r.ok,r.text; return r.json()
 @classmethod
 def cleanup(cls):
  d=lambda t,p: requests.delete(cls.url+'/rest/v1/'+t,headers=cls.svc,params=p,timeout=30)
  ids=f'in.({A},{B},{D})'
  for t in ['pontos','selos','vendas','metas','clientes']: d(t,{'vendedor_id':ids})
  d('notificacoes',{'usuario_id':ids}); d('preferencias_notificacao',{'usuario_id':ids})
  for uid in cls.auth: requests.delete(cls.url+'/auth/v1/admin/users/'+uid,headers=cls.svc,timeout=30)
  d('user_roles',{'user_id':'in.('+','.join(cls.auth or [str(uuid.uuid4())])+')'})
  for f in ['vendedor_id','usuario_id']: d('registro_auditoria',{f:ids})
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('usuarios','id')]: d(t,{f:ids})
 def rpc(self,who,fn,body): return requests.post(self.url+'/rest/v1/rpc/'+fn,headers=self.h[who],json=body,timeout=60)
 def test_0_demo(self):
  r=self.rpc(D,'apagar_dados_demo',{}); self.assertTrue(r.ok,r.text)
  r=self.rpc(D,'carregar_dados_demo',{}); self.assertTrue(r.ok,r.text)
  cnt=lambda t,p: len(self.get(t,{**p,'demo':'eq.true','select':'id'}))
  n=(cnt('itens_venda',{}),cnt('clientes',{'etiquetas':'neq.{}'}),cnt('notas_cliente',{}),cnt('posts_instagram',{'status':'eq.pendente'}),cnt('orcamentos',{'proximo_followup':'not.is.null'}))
  print('\ndemo itens/etiquetas/notas/posts/followups:',n); self.assertTrue(n[0]>0 and n[1]>0 and n[2]==10 and n[3]==2 and n[4]==3)
 def test_1_painel(self):
  rd=self.rpc(D,'painel_gestao',{'_empresa_id':self.emp,'_hoje':DIA}); self.assertTrue(rd.ok,rd.text)
  nomes={x['nome'] for x in rd.json()}; self.assertTrue({'Humberto Demo','Clara Demo'}<=nomes,nomes)
  ra=self.rpc(A,'painel_gestao',{'_empresa_id':self.emp,'_hoje':DIA}).json(); self.assertEqual([x['vendedor_id'] for x in ra],[A])
  print('painel diretoria:',sorted(nomes))
 def test_2_copiloto(self):
  r=requests.patch(self.url+'/rest/v1/usuarios',headers=self.h[A],params={'id':'eq.'+A},json={'pinguim_versao':'pizzaiolo','copiloto_minimizado':True},timeout=30); self.assertEqual(r.json()[0]['pinguim_versao'],'pizzaiolo')
  r=requests.patch(self.url+'/rest/v1/usuarios',headers=self.h[A],params={'id':'eq.'+B},json={'pinguim_versao':'acougueiro'},timeout=30); self.assertEqual(r.json(),[])
  self.assertEqual(self.get('usuarios',{'id':'eq.'+B})[0]['pinguim_versao'],'consultor')
 def test_3_notificacoes(self):
  it=[{'tipo':'tarefa','titulo':'T','chave':'k1'},{'tipo':'tarefa','titulo':'T','chave':'k1'}]
  self.assertEqual(self.rpc(A,'registrar_notificacoes',{'_itens':it}).json(),1)
  self.assertEqual(self.rpc(A,'registrar_notificacoes',{'_itens':it}).json(),0)
  requests.post(self.url+'/rest/v1/preferencias_notificacao',headers=self.h[A],json={'usuario_id':A,'tipos_desligados':['selo']},timeout=30).raise_for_status()
  self.assertEqual(self.rpc(A,'registrar_notificacoes',{'_itens':[{'tipo':'selo','titulo':'S','chave':'k2'}]}).json(),0)
  self.assertEqual(requests.get(self.url+'/rest/v1/notificacoes',headers=self.h[B],timeout=30).json(),[])
  self.assertEqual(len(requests.get(self.url+'/rest/v1/notificacoes',headers=self.h[A],timeout=30).json()),1)
 def test_4_cobertura_compra(self):
  r=self.rpc(A,'calcular_pontos_dia',{'_empresa_id':self.emp,'_vendedor_id':A,'_dia':DIA}); self.assertTrue(r.ok,r.text); self.assertEqual(r.json()['cobertura'],20)
if __name__=='__main__': unittest.main()
