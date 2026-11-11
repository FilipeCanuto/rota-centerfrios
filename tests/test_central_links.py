"""Central de links e arquivos: regressão autenticada com fixtures temporárias."""
import os,secrets,unittest,uuid
from pathlib import Path
import requests
ADM,V=str(uuid.uuid4()),str(uuid.uuid4()); TAG='LNKT'+uuid.uuid4().hex[:6]; PDF=b'%PDF-1.4\n%teste\n'
class Links(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.svc={'apikey':key,'Content-Type':'application/json'}
  if not key.startswith('sb_'): cls.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.auth=[]; cls.h={}; cls.addClassCleanup(cls.cleanup)
  emp=requests.get(cls.url+'/rest/v1/empresas',headers=cls.svc,params={'nome':'eq.CENTERFRIOS'}).json()[0]['id']
  for uid,n,role in [(ADM,'adm','administrador'),(V,'vend','vendedor')]:
   for t,d in [('usuarios',{'id':uid,'nome':'Links '+n,'email':f'links.{n}.teste@centerfrios.com','empresa_id':emp}),('usuario_empresas',{'usuario_id':uid,'empresa_id':emp}),('papeis_pre_cadastro',{'usuario_id':uid,'role':role,'empresa_id':None if role=='administrador' else emp})]:
    r=requests.post(cls.url+'/rest/v1/'+t,headers=cls.svc,json=d); assert r.ok,r.text
   email=f'links.{n}.teste@centerfrios.com'; pw=secrets.token_urlsafe(32)
   r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.svc,json={'email':email,'password':pw,'email_confirm':True}); r.raise_for_status(); cls.auth.append(r.json()['id'])
   r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.pub,json={'email':email,'password':pw}); r.raise_for_status()
   cls.h[uid]={**cls.pub,'Authorization':'Bearer '+r.json()['access_token']}
 @classmethod
 def cleanup(cls):
  requests.delete(cls.url+'/storage/v1/object/arquivos',headers=cls.svc,json={'prefixes':[f'{TAG}/catalogo.pdf',f'{TAG}/v.pdf']})
  d=lambda t,p: requests.delete(cls.url+'/rest/v1/'+t,headers=cls.svc,params=p)
  d('links',{'titulo':f'like.{TAG}*'})
  for uid in cls.auth: requests.delete(cls.url+'/auth/v1/admin/users/'+uid,headers=cls.svc)
  d('user_roles',{'user_id':'in.('+','.join(cls.auth or [str(uuid.uuid4())])+')'})
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('registro_auditoria','vendedor_id'),('usuarios','id')]: d(t,{f:f'in.({ADM},{V})'})
 def rest(self,who,m,t,**k): return requests.request(m,self.url+'/rest/v1/'+t,headers={**self.h[who],'Content-Type':'application/json','Prefer':'return=representation'},**k)
 def up(self,who,path): return requests.post(self.url+f'/storage/v1/object/arquivos/{path}',headers={**self.h[who],'Content-Type':'application/pdf'},data=PDF)
 def test_fluxo(self):
  r=self.up(ADM,f'{TAG}/catalogo.pdf'); self.assertTrue(r.ok,r.text)
  r=self.rest(ADM,'POST','links',json=[{'empresa_id':None,'titulo':TAG+' Catálogo','arquivo_path':f'{TAG}/catalogo.pdf','mensagem_whatsapp':'Segue o catálogo','publico':'interno'},
   {'empresa_id':None,'titulo':TAG+' Inativo','url':'https://example.com','ativo':False,'publico':'interno'}]); self.assertTrue(r.ok,r.text)
  self.assertEqual(len(self.rest(ADM,'GET','links',params={'titulo':f'like.{TAG}*'}).json()),2)
  vis=[l['titulo'] for l in self.rest(V,'GET','links',params={'titulo':f'like.{TAG}*'}).json()]; self.assertEqual(vis,[TAG+' Catálogo'])
  r=requests.post(self.url+f'/storage/v1/object/sign/arquivos/{TAG}/catalogo.pdf',headers={**self.h[V],'Content-Type':'application/json'},json={'expiresIn':604800}); self.assertTrue(r.ok,r.text)
  self.assertEqual(requests.get(self.url+'/storage/v1'+r.json()['signedURL']).content,PDF)
  self.assertFalse(self.up(V,f'{TAG}/v.pdf').ok)
  self.assertEqual(self.rest(V,'POST','links',json={'titulo':TAG+' V','url':'https://x.com','publico':'interno'}).status_code,403)
  self.assertEqual(self.rest(ADM,'POST','links',json={'titulo':TAG+' vazio','publico':'interno'}).status_code,400)
  print('ok: admin cria/envia; vendedor vê só ativo, assina 7 dias, não envia nem cria')
if __name__=='__main__': unittest.main()
