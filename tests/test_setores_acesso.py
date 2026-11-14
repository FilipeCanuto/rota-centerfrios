"""Setores: camada RESTRICTIVE do Comercial e cadastro pelo administrador, com fixtures temporárias."""
import os,secrets,unittest,uuid,datetime
from pathlib import Path
import requests
V,S,AD,D,D2,C=(str(uuid.uuid4()) for _ in range(6)); INICIO=datetime.datetime.now(datetime.timezone.utc).isoformat()
NOVO_EMAIL='setor.novo.teste@centerfrios.com'; ARQ=f'teste-setor-{uuid.uuid4()}.pdf'
class Setores(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.svc={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'}
  if not key.startswith('sb_'): cls.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.auth=[]; cls.h={}; cls.addClassCleanup(cls.cleanup)
  cls.emp=emp=cls.get('empresas',{'nome':'eq.CENTERFRIOS'})[0]['id']
  users=[(V,'v','vendedor',emp,[]),(S,'s','vendedor',emp,['comercial']),(AD,'ad','administrador',None,['comercial']),(D,'d','diretoria',None,['comercial']),(D2,'d2','diretoria',None,[])]
  for uid,n,role,e,setores in users:
   cls.ins('usuarios',{'id':uid,'nome':'Setor '+n,'email':f'setor.{n}.teste@centerfrios.com','empresa_id':emp})
   cls.ins('usuario_empresas',{'usuario_id':uid,'empresa_id':emp}); cls.ins('papeis_pre_cadastro',{'usuario_id':uid,'role':role,'empresa_id':e})
   for st in setores: cls.ins('usuario_setores',{'usuario_id':uid,'setor':st})
  cls.ins('clientes',{'id':C,'empresa_id':emp,'vendedor_id':S,'nome':'Cliente setor'})
  r=requests.post(cls.url+'/storage/v1/object/arquivos/'+ARQ,headers={k:v for k,v in cls.svc.items() if k!='Content-Type'}|{'Content-Type':'application/pdf'},data=b'%PDF-1.4 teste',timeout=30); assert r.ok,r.text
  for uid,n,*_ in users:
   email=f'setor.{n}.teste@centerfrios.com'; pw=secrets.token_urlsafe(32)
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
  requests.delete(cls.url+'/storage/v1/object/arquivos/'+ARQ,headers=cls.svc,timeout=30)
  novo=[u['id'] for u in cls.get('usuarios',{'email':'eq.'+NOVO_EMAIL})]
  ids='in.('+','.join([V,S,AD,D,D2]+novo)+')'
  for t in ['tarefas_agenda','clientes']: d(t,{'vendedor_id':ids})
  for uid in cls.auth: requests.delete(cls.url+'/auth/v1/admin/users/'+uid,headers=cls.svc,timeout=30)
  d('user_roles',{'user_id':'in.('+','.join(cls.auth or [str(uuid.uuid4())])+')'})
  for f in ['vendedor_id','usuario_id','registro_id']: d('registro_auditoria',{f:ids})
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('usuario_setores','usuario_id'),('usuarios','id')]: d(t,{f:ids})
 def q(self,who,t,p=None): return requests.get(self.url+'/rest/v1/'+t,headers=self.h[who],params=p or {'select':'*'},timeout=30)
 def n(self,who,t): r=self.q(who,t); self.assertTrue(r.ok,r.text); return len(r.json())
 def rpc(self,who,fn,body): return requests.post(self.url+'/rest/v1/rpc/'+fn,headers=self.h[who],json=body,timeout=30)
 def code(self,r): return r.json().get('code') if not r.ok else None
 def salvar(self,who,alvo,papeis,setores): return self.rpc(who,'admin_salvar_acessos',{'_usuario_id':alvo,'_papeis':papeis,'_empresas':[self.emp],'_setores':setores})
 def test_1_sem_setor(self):
  for t in ['clientes','vendas','orcamentos','metas','links','notificacoes']: self.assertEqual(self.n(V,t),0,t)
  hoje='2026-11-14'
  r=requests.post(self.url+'/rest/v1/interacoes',headers=self.h[V],json={'empresa_id':self.emp,'cliente_id':C,'vendedor_id':V,'tipo':'ligacao'},timeout=30); self.assertFalse(r.ok)
  r=requests.post(self.url+'/rest/v1/tarefas_agenda',headers=self.h[V],json={'empresa_id':self.emp,'vendedor_id':V,'titulo':'x','data':hoje},timeout=30); self.assertFalse(r.ok)
  r=requests.patch(self.url+'/rest/v1/orcamentos',headers=self.h[V],params={'empresa_id':'eq.'+self.emp},json={'observacao':'x'},timeout=30); self.assertTrue(r.ok and r.json()==[] or not r.ok)
  self.assertEqual(self.code(self.rpc(V,'importar_vendas',{'_empresa_id':self.emp,'_arquivo':'t','_linhas':[]})),'42501')
  self.assertEqual(self.code(self.rpc(V,'calcular_pontos_dia',{'_empresa_id':self.emp,'_vendedor_id':V,'_dia':hoje})),'42501')
  r=requests.get(self.url+'/storage/v1/object/authenticated/arquivos/'+ARQ,headers=self.h[V],timeout=30); self.assertFalse(r.ok)
  self.assertEqual(self.rpc(V,'meus_setores',{}).json(),[])
 def test_2_um_setor(self):
  self.assertEqual([c['id'] for c in self.q(S,'clientes').json()],[C])
  r=requests.post(self.url+'/rest/v1/tarefas_agenda',headers=self.h[S],json={'empresa_id':self.emp,'vendedor_id':S,'cliente_id':C,'titulo':'Ligar','data':'2026-11-14','tipo':'ligacao'},timeout=30); self.assertTrue(r.ok,r.text)
  r=requests.get(self.url+'/storage/v1/object/authenticated/arquivos/'+ARQ,headers=self.h[S],timeout=30); self.assertTrue(r.ok,r.text)
  self.assertEqual(self.rpc(S,'meus_setores',{}).json(),['comercial'])
 def test_3_dois_setores_e_retirada(self):
  self.ins('usuario_setores',{'usuario_id':S,'setor':'rh'})
  self.assertEqual(self.rpc(S,'meus_setores',{}).json(),['comercial','rh']); self.assertEqual(self.n(S,'clientes'),1)
  r=self.salvar(AD,S,['vendedor'],['rh']); self.assertTrue(r.ok,r.text)
  self.assertEqual(self.n(S,'clientes'),0); self.assertEqual(self.rpc(S,'meus_setores',{}).json(),['rh'])
 def test_4_administrador(self):
  self.assertEqual(self.n(AD,'clientes'),0)
  r=self.rpc(AD,'admin_pre_cadastrar',{'_nome':'Novo Setor','_email':'  '+NOVO_EMAIL.upper(),'_papeis':['vendedor'],'_empresas':[self.emp],'_setores':['comercial']}); self.assertTrue(r.ok,r.text); novo=r.json()
  self.assertEqual(self.get('usuarios',{'id':'eq.'+novo})[0]['email'],NOVO_EMAIL)
  self.assertEqual([x['role'] for x in self.get('papeis_pre_cadastro',{'usuario_id':'eq.'+novo})],['vendedor'])
  r=self.salvar(AD,novo,['vendedor','supervisor'],['comercial','rh']); self.assertTrue(r.ok,r.text)
  acoes={a['acao'] for a in self.get('registro_auditoria',{'registro_id':'eq.'+novo})}; self.assertTrue({'pre_cadastro','alteracao_acessos'}<=acoes,acoes)
  self.assertFalse(self.salvar(AD,novo,['vendedor'],[]).ok)
  self.assertFalse(self.salvar(AD,novo,['vendedor'],['RH!']).ok)
  self.assertFalse(self.salvar(AD,AD,['diretoria'],['comercial']).ok)
  self.assertFalse(self.rpc(AD,'admin_atualizar_usuario',{'_usuario_id':AD,'_dados':{'ativo':False}}).ok)
  self.assertFalse(self.rpc(AD,'admin_pre_cadastrar',{'_nome':'X','_email':NOVO_EMAIL,'_papeis':['vendedor'],'_empresas':[self.emp],'_setores':['comercial']}).ok)
 def test_5_diretoria(self):
  self.assertIn(C,[c['id'] for c in self.q(D,'clientes',{'select':'id','id':'eq.'+C}).json()])
  self.assertGreater(len(self.q(D,'clientes',{'select':'empresa_id'}).json()),1)
  self.assertEqual(self.n(D2,'clientes'),0)
  for f in ['importar_clientes','importar_vendas','importar_orcamentos']: self.assertEqual(self.code(self.rpc(D2,f,{'_empresa_id':self.emp,'_arquivo':'t','_linhas':[]})),'42501',f)
 def test_6_invalidos(self):
  r=requests.post(self.url+'/rest/v1/usuario_setores',headers=self.h[V],json={'usuario_id':V,'setor':'comercial'},timeout=30); self.assertFalse(r.ok)
  r=requests.patch(self.url+'/rest/v1/usuario_setores',headers=self.h[S],params={'usuario_id':'eq.'+S},json={'ativo':True},timeout=30); self.assertFalse(r.ok)
  r=requests.delete(self.url+'/rest/v1/usuario_setores',headers=self.h[S],params={'usuario_id':'eq.'+S},timeout=30); self.assertFalse(r.ok)
  self.assertEqual(self.code(self.salvar(V,V,['administrador'],['comercial'])),'42501')
  self.assertEqual(self.code(self.rpc(V,'admin_pre_cadastrar',{'_nome':'X','_email':'x.teste@centerfrios.com','_papeis':['vendedor'],'_empresas':[self.emp],'_setores':['comercial']})),'42501')
  r=requests.patch(self.url+'/rest/v1/usuarios',headers=self.h[V],params={'id':'eq.'+V},json={'ativo':True},timeout=30); self.assertFalse(r.ok)
 def test_7_conta_desativada(self):
  self.assertGreater(self.n(D,'clientes'),0)
  r=self.rpc(AD,'admin_atualizar_usuario',{'_usuario_id':D,'_dados':{'ativo':False}}); self.assertTrue(r.ok,r.text)
  self.assertEqual(self.rpc(D,'meus_setores',{}).json(),[]); self.assertEqual(self.n(D,'clientes'),0)
  self.assertTrue(self.get('usuario_setores',{'usuario_id':'eq.'+D,'setor':'eq.comercial'})[0]['ativo'])
  self.assertTrue(any(a['detalhes'].get('permissao')=='ativo' for a in self.get('registro_auditoria',{'registro_id':'eq.'+D,'acao':'eq.alteracao_permissao'})))
 def test_8_dados_atuais(self):
  fixtures={V,S,AD,D,D2}|{u['id'] for u in self.get('usuarios',{'email':'eq.'+NOVO_EMAIL})}
  com={s['usuario_id'] for s in self.get('usuario_setores',{'setor':'eq.comercial','ativo':'is.true','select':'usuario_id'})}
  faltando=[u['id'] for u in self.get('usuarios',{'select':'id'}) if u['id'] not in fixtures and u['id'] not in com]
  self.assertEqual(faltando,[])
if __name__=='__main__': unittest.main()
