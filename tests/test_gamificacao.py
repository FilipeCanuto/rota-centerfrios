"""Gamificação: pontos, ranking e posts do Instagram com fixtures temporárias."""
import os,secrets,unittest,uuid,datetime
from pathlib import Path
import requests
A,B,D,C=(str(uuid.uuid4()) for _ in range(4)); DIA='2026-11-11'; INICIO=datetime.datetime.now(datetime.timezone.utc).isoformat()
class Gamificacao(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.svc={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'}
  if not key.startswith('sb_'): cls.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.auth=[]; cls.h={}; cls.addClassCleanup(cls.cleanup)
  cls.emp=emp=cls.get('empresas',{'nome':'eq.CENTERFRIOS'})[0]['id']
  for uid,n,role,e in [(A,'a','vendedor',emp),(B,'b','vendedor',emp),(D,'d','diretoria',None)]:
   cls.ins('usuarios',{'id':uid,'nome':'Gam '+n,'email':f'gam.{n}.teste@centerfrios.com','empresa_id':emp})
   cls.ins('usuario_empresas',{'usuario_id':uid,'empresa_id':emp}); cls.ins('papeis_pre_cadastro',{'usuario_id':uid,'role':role,'empresa_id':e})
  cls.ins('clientes',{'id':C,'empresa_id':emp,'vendedor_id':A,'nome':'Cliente gam'})
  cls.ins('metas',{'empresa_id':emp,'vendedor_id':A,'mes':'2026-11-01','meta_vendas':22000,'meta_orcamentos':0,'meta_cobertura':0,'meta_reativacao':0})
  cls.ins('vendas',{'empresa_id':emp,'vendedor_id':A,'cliente_id':C,'data_faturamento':DIA,'valor':22000})
  for uid,n in [(A,'a'),(B,'b'),(D,'d')]:
   email=f'gam.{n}.teste@centerfrios.com'; pw=secrets.token_urlsafe(32)
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
  requests.patch(cls.url+'/rest/v1/configuracoes_texto',headers=cls.svc,params={'empresa_id':'eq.'+cls.emp,'chave':'eq.hashtag_campanha'},json={'valor':''},timeout=30)
  ids=f'in.({A},{B},{D})'
  for t in ['pontos','selos','posts_instagram','vendas','metas','clientes']: d(t,{'vendedor_id':ids})
  for uid in cls.auth: requests.delete(cls.url+'/auth/v1/admin/users/'+uid,headers=cls.svc,timeout=30)
  d('user_roles',{'user_id':'in.('+','.join(cls.auth or [str(uuid.uuid4())])+')'})
  d('registro_auditoria',{'tabela':'eq.configuracoes_texto','created_at':'gte.'+INICIO})
  for f in ['vendedor_id','usuario_id']: d('registro_auditoria',{f:ids})
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('usuarios','id')]: d(t,{f:ids})
 def rpc(self,who,fn,body): return requests.post(self.url+'/rest/v1/rpc/'+fn,headers=self.h[who],json=body,timeout=30)
 def pontos(self,ind): return [p['pontos'] for p in self.get('pontos',{'vendedor_id':'eq.'+A,'data':'eq.'+DIA,'indicador':'eq.'+ind})]
 def test_1_vendas_idempotente(self):
  for _ in range(2):
   r=self.rpc(A,'calcular_pontos_dia',{'_empresa_id':self.emp,'_vendedor_id':A,'_dia':DIA}); self.assertTrue(r.ok,r.text); self.assertEqual(r.json()['vendas'],30)
  self.assertEqual(self.pontos('vendas'),[30])
  self.assertEqual(self.rpc(B,'calcular_pontos_dia',{'_empresa_id':self.emp,'_vendedor_id':A,'_dia':DIA}).status_code,403)
 def test_2_inserir_pontos(self):
  r=requests.post(self.url+'/rest/v1/pontos',headers=self.h[A],json={'empresa_id':self.emp,'vendedor_id':A,'data':DIA,'indicador':'x','pontos':999},timeout=30); self.assertIn(r.status_code,(401,403),r.text)
 def test_3_ranking(self):
  self.assertTrue(self.rpc(D,'calcular_pontos_dia',{'_empresa_id':self.emp,'_vendedor_id':B,'_dia':DIA}).ok)
  self.rpc(A,'calcular_pontos_dia',{'_empresa_id':self.emp,'_vendedor_id':A,'_dia':DIA})
  p={'_empresa_id':self.emp,'_inicio':'2026-11-01','_fim':'2026-11-30'}
  rb=self.rpc(B,'ranking',p).json(); rd=self.rpc(D,'ranking',p).json()
  self.assertLessEqual(len(rb),4); self.assertEqual(sum(x['eh_voce'] for x in rb),1)
  self.assertTrue({A,B}<={x['vendedor_id'] for x in rd}); self.assertGreaterEqual(len(rd),len(rb))
  print('\nranking vendedor:',len(rb),'linhas; diretoria:',len(rd))
 def test_4_instagram(self):
  post=lambda leg: requests.post(self.url+'/rest/v1/posts_instagram',headers=self.h[A],json={'empresa_id':self.emp,'vendedor_id':A,'url':'https://instagram.com/p/x','legenda':leg,'data_post':DIA},timeout=30).json()[0]['id']
  p1=post('Promoção da semana')
  r=self.rpc(D,'validar_post_instagram',{'_post_id':p1,'_aprovar':True,'_motivo':None}); self.assertIn('precisa citar @centerfriosoficial',r.text)
  self.assertEqual(self.rpc(A,'validar_post_instagram',{'_post_id':p1,'_aprovar':True,'_motivo':None}).status_code,403)
  p2=post('Chegou estoque! @CenterfriosOficial')
  r=self.rpc(D,'validar_post_instagram',{'_post_id':p2,'_aprovar':True,'_motivo':None}); self.assertTrue(r.ok,r.text); self.assertEqual(self.pontos('instagram'),[5])
  requests.patch(self.url+'/rest/v1/configuracoes_texto',headers=self.svc,params={'empresa_id':'eq.'+self.emp,'chave':'eq.hashtag_campanha'},json={'valor':'#VeraoCF'},timeout=30).raise_for_status()
  p3=post('Ofertas #veraocf')
  r=self.rpc(D,'validar_post_instagram',{'_post_id':p3,'_aprovar':True,'_motivo':None}); self.assertTrue(r.ok,r.text); self.assertEqual(self.pontos('instagram'),[10])
  self.assertTrue(self.get('registro_auditoria',{'acao':'eq.validacao_instagram','vendedor_id':'eq.'+A}))
if __name__=='__main__': unittest.main()
