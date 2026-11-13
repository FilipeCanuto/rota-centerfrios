"""Quadro de avisos e mídia do login: RLS, armazenamento e validação com fixtures temporárias."""
import os,secrets,unittest,uuid
from pathlib import Path
import requests
S,A,B,ADM=(str(uuid.uuid4()) for _ in range(4)); TAG='AVT'+uuid.uuid4().hex[:6]
PNG=b'\x89PNG\r\n\x1a\n'+b'0'*100
class Avisos(unittest.TestCase):
 @classmethod
 def setUpClass(c):
  c.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; c.svc={'apikey':key,'Content-Type':'application/json'}
  if not key.startswith('sb_'): c.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  c.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; c.auth=[]; c.h={}; c.addClassCleanup(c.cleanup)
  emp=requests.get(c.url+'/rest/v1/empresas',headers=c.svc,params={'nome':'eq.CENTERFRIOS'}).json()[0]['id']
  for uid,n,role,pub in [(S,'s','vendedor',False),(A,'a','vendedor',True),(B,'b','vendedor',True),(ADM,'adm','administrador',False)]:
   email=f'avisos.{n}.{TAG.lower()}@centerfrios.com'
   for t,d in [('usuarios',{'id':uid,'nome':'Avisos '+n,'email':email,'empresa_id':emp,'pode_publicar_avisos':pub}),('usuario_empresas',{'usuario_id':uid,'empresa_id':emp}),('papeis_pre_cadastro',{'usuario_id':uid,'role':role,'empresa_id':None if role=='administrador' else emp})]:
    r=requests.post(c.url+'/rest/v1/'+t,headers=c.svc,json=d); assert r.ok,r.text
   pw=secrets.token_urlsafe(32)
   r=requests.post(c.url+'/auth/v1/admin/users',headers=c.svc,json={'email':email,'password':pw,'email_confirm':True}); r.raise_for_status(); c.auth.append(r.json()['id'])
   r=requests.post(c.url+'/auth/v1/token?grant_type=password',headers=c.pub,json={'email':email,'password':pw}); r.raise_for_status()
   c.h[uid]={**c.pub,'Authorization':'Bearer '+r.json()['access_token']}
  c.h['anon']=dict(c.pub)
 @classmethod
 def cleanup(c):
  for bk in ['avisos','midia-login']:
   lst=requests.post(c.url+f'/storage/v1/object/list/{bk}',headers=c.svc,json={'prefix':TAG,'limit':100}).json()
   if isinstance(lst,list) and lst: requests.delete(c.url+f'/storage/v1/object/{bk}',headers=c.svc,json={'prefixes':[f'{TAG}/{o["name"]}' for o in lst]})
  d=lambda t,p: requests.delete(c.url+'/rest/v1/'+t,headers=c.svc,params=p)
  d('avisos',{'titulo':f'like.{TAG}*'}); d('midia_login',{'arquivo_path':f'like.{TAG}*'})
  for uid in c.auth: requests.delete(c.url+'/auth/v1/admin/users/'+uid,headers=c.svc)
  d('user_roles',{'user_id':'in.('+','.join(c.auth or [str(uuid.uuid4())])+')'})
  ids=f'in.({S},{A},{B},{ADM})'
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('registro_auditoria','vendedor_id'),('registro_auditoria','registro_id'),('usuarios','id')]: d(t,{f:ids})
 def rest(s,who,m,t,**k): return requests.request(m,s.url+'/rest/v1/'+t,headers={**s.h[who],'Content-Type':'application/json','Prefer':'return=representation'},**k)
 def up(s,who,bk,name,data=PNG,mime='image/png',upsert=False):
  h={**s.h[who],'Content-Type':mime}
  if upsert: h['x-upsert']='true'
  return requests.post(s.url+f'/storage/v1/object/{bk}/{TAG}/{name}',headers=h,data=data)
 def aviso(s,who,t,**x): return s.rest(who,'POST','avisos',json={'titulo':TAG+t,'texto_alternativo':'Imagem do aviso','arquivo_path':f'{TAG}/{t}.png','tipo':'imagem',**x})
 def test_1_sem_permissao(s):
  s.assertEqual(s.aviso(S,'s').status_code,403)
  s.assertFalse(s.up(S,'avisos','s.png').ok)
  r=s.rest(S,'PATCH','usuarios',params={'id':f'eq.{S}'},json={'pode_publicar_avisos':True}); s.assertFalse(r.ok)
  s.assertEqual(s.rest(S,'GET','avisos').status_code,200)
 def test_2_publicadores_e_admin(s):
  r=s.aviso(A,'a'); s.assertTrue(r.ok,r.text); ida=r.json()[0]['id']; s.assertEqual(r.json()[0]['criado_por'],A)
  s.assertTrue(s.up(A,'avisos','a.png').ok)
  s.assertTrue(s.up(A,'avisos','a.png',upsert=True).ok)
  r=s.aviso(B,'b',criado_por=A); idb=r.json()[0]['id']; s.assertEqual(r.json()[0]['criado_por'],B)
  s.assertTrue(s.up(B,'avisos','b.png').ok)
  s.assertEqual(s.rest(A,'PATCH','avisos',params={'id':f'eq.{ida}'},json={'titulo':TAG+'a2'}).json()[0]['titulo'],TAG+'a2')
  s.assertEqual(s.rest(A,'PATCH','avisos',params={'id':f'eq.{idb}'},json={'titulo':TAG+'x'}).json(),[])
  s.assertEqual(s.rest(A,'DELETE','avisos',params={'id':f'eq.{idb}'}).json(),[])
  s.assertFalse(s.up(A,'avisos','b.png',upsert=True).ok)
  requests.delete(s.url+f'/storage/v1/object/avisos/{TAG}/b.png',headers=s.h[A])
  s.assertIsNotNone(requests.post(s.url+f'/storage/v1/object/list/avisos',headers={**s.svc},json={'prefix':TAG,'search':'b.png'}).json())
  s.assertEqual(s.rest(A,'PATCH','avisos',params={'id':f'eq.{ida}'},json={'criado_por':B}).json()[0]['criado_por'],A)
  s.assertEqual(len(s.rest(A,'DELETE','avisos',params={'id':f'eq.{ida}'}).json()),1)
  s.assertEqual(s.rest(A,'POST','midia_login',json={'arquivo_path':TAG+'/m.png','tipo':'imagem','texto_alternativo':'x'}).status_code,403)
  s.assertFalse(s.up(A,'midia-login','m.png').ok)
  # admin
  s.assertEqual(len(s.rest(ADM,'PATCH','avisos',params={'id':f'eq.{idb}'},json={'ativo':False}).json()),1)
  s.assertEqual(len(s.rest(ADM,'DELETE','avisos',params={'id':f'eq.{idb}'}).json()),1)
  for v in [False,True]:
   r=s.rest(ADM,'POST','rpc/admin_atualizar_usuario',json={'_usuario_id':A,'_dados':{'pode_publicar_avisos':v}}); s.assertTrue(r.ok,r.text)
  s.assertEqual(s.rest(ADM,'POST','rpc/admin_atualizar_usuario',json={'_usuario_id':A,'_dados':{'pode_publicar_avisos':'sim'}}).status_code,400)
  aud=requests.get(s.url+'/rest/v1/registro_auditoria',headers=s.svc,params={'registro_id':f'eq.{A}','acao':'eq.alteracao_permissao'}).json(); s.assertEqual(len(aud),2)
  s.assertTrue(s.up(ADM,'midia-login','ativa.png').ok); s.assertTrue(s.up(ADM,'midia-login','inativa.png').ok)
  r=s.rest(ADM,'POST','midia_login',json=[{'arquivo_path':f'{TAG}/ativa.png','tipo':'imagem','texto_alternativo':'Ativa','ativo':True},{'arquivo_path':f'{TAG}/inativa.png','tipo':'imagem','texto_alternativo':'Inativa','ativo':True}]); s.assertTrue(r.ok,r.text)
  s.assertEqual(len(s.rest(ADM,'PATCH','midia_login',params={'arquivo_path':f'eq.{TAG}/inativa.png'},json={'ativo':False}).json()),1)
  s.assertEqual(len(s.rest(ADM,'GET','midia_login',params={'arquivo_path':f'like.{TAG}*'}).json()),2)
  # anon
  s.assertEqual([m['texto_alternativo'] for m in s.rest('anon','GET','midia_login',params={'arquivo_path':f'like.{TAG}*'}).json()],['Ativa'])
  s.assertEqual(s.rest('anon','GET','avisos').json() if s.rest('anon','GET','avisos').ok else [],[])
  sign=lambda bk,n: requests.post(s.url+f'/storage/v1/object/sign/{bk}/{TAG}/{n}',headers={**s.h['anon'],'Content-Type':'application/json'},json={'expiresIn':60})
  r=sign('midia-login','ativa.png'); s.assertTrue(r.ok,r.text); s.assertEqual(requests.get(s.url+'/storage/v1'+r.json()['signedURL']).content,PNG)
  s.assertFalse(sign('midia-login','inativa.png').ok)
  s.assertFalse(sign('avisos','a.png').ok)
  s.assertTrue(requests.delete(s.url+f'/storage/v1/object/midia-login/{TAG}/inativa.png',headers=s.h[ADM]).json())
  s.assertEqual(len(s.rest(ADM,'DELETE','midia_login',params={'arquivo_path':f'eq.{TAG}/inativa.png'}).json()),1)
 def test_3_validacao(s):
  s.assertFalse(s.up(A,'avisos','x.pdf',b'%PDF-1.4',mime='application/pdf').ok)
  s.assertFalse(s.up(A,'avisos','x.exe',b'MZ'+b'0'*10,mime='application/octet-stream').ok)
  s.assertFalse(s.up(A,'avisos','x.png',b'MZ',mime='application/x-msdownload').ok)
  s.assertFalse(s.up(A,'avisos','g6.png',b'0'*(6*1024*1024)).ok)
  s.assertFalse(s.up(A,'avisos','v26.mp4',b'0'*(26*1024*1024),mime='video/mp4').ok)
  s.assertTrue(s.up(A,'avisos','g4.png',b'0'*(4*1024*1024)).ok)
  r=s.up(A,'avisos','v20.mp4',b'0'*(20*1024*1024),mime='video/mp4'); s.assertTrue(r.ok,r.text)
  s.assertEqual(s.aviso(A,'alt',texto_alternativo='  ').status_code,400)
  s.assertEqual(s.aviso(A,'dt',inicio='2026-12-10T00:00:00Z',fim='2026-12-01T00:00:00Z').status_code,400)
  s.assertEqual(s.aviso(A,'ln',link='www.centerfrios.com').status_code,400)
if __name__=='__main__': unittest.main(verbosity=2)
