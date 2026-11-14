"""Catálogo editável de setores e enquadramento da mídia do login, com fixtures temporárias (chamadas como authenticated)."""
import os,secrets,unittest,uuid,datetime
from pathlib import Path
import requests
V,SU,D,AD=(str(uuid.uuid4()) for _ in range(4)); TAG='SET'+uuid.uuid4().hex[:6].lower()
INICIO=datetime.datetime.now(datetime.timezone.utc).isoformat(); C=str(uuid.uuid4())
class SetoresEditaveis(unittest.TestCase):
 @classmethod
 def setUpClass(c):
  c.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; c.svc={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'}
  if not key.startswith('sb_'): c.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  c.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; c.auth=[]; c.h={}; c.addClassCleanup(c.cleanup)
  emp=c.get('empresas',{'nome':'eq.CENTERFRIOS'})[0]['id']
  users=[(V,'v','vendedor',emp,['comercial','rh']),(SU,'su','supervisor',emp,['comercial']),(D,'d','diretoria',None,['comercial']),(AD,'ad','administrador',None,['comercial'])]
  for uid,n,role,e,st in users:
   email=f'{TAG}.{n}@centerfrios.com'
   c.ins('usuarios',{'id':uid,'nome':'Setor ed '+n,'email':email,'empresa_id':emp}); c.ins('usuario_empresas',{'usuario_id':uid,'empresa_id':emp})
   c.ins('papeis_pre_cadastro',{'usuario_id':uid,'role':role,'empresa_id':e})
   for s in st: c.ins('usuario_setores',{'usuario_id':uid,'setor':s})
  c.ins('clientes',{'id':C,'empresa_id':emp,'vendedor_id':V,'nome':'Cliente '+TAG})
  c.midia=c.ins('midia_login',{'arquivo_path':f'{TAG}/m.png','tipo':'imagem','texto_alternativo':'Teste','ativo':True})[0]['id']
  for uid,n,*_ in users:
   email=f'{TAG}.{n}@centerfrios.com'; pw=secrets.token_urlsafe(32)
   r=requests.post(c.url+'/auth/v1/admin/users',headers=c.svc,json={'email':email,'password':pw,'email_confirm':True},timeout=30); r.raise_for_status(); c.auth.append(r.json()['id'])
   r=requests.post(c.url+'/auth/v1/token?grant_type=password',headers=c.pub,json={'email':email,'password':pw},timeout=30); r.raise_for_status()
   c.h[uid]={**c.pub,'Authorization':'Bearer '+r.json()['access_token'],'Content-Type':'application/json','Prefer':'return=representation'}
  c.h['anon']={**c.pub,'Content-Type':'application/json','Prefer':'return=representation'}
 @classmethod
 def get(c,t,p): r=requests.get(c.url+'/rest/v1/'+t,headers=c.svc,params=p,timeout=30); r.raise_for_status(); return r.json()
 @classmethod
 def ins(c,t,d): r=requests.post(c.url+'/rest/v1/'+t,headers=c.svc,json=d,timeout=30); assert r.ok,r.text; return r.json()
 @classmethod
 def cleanup(c):
  d=lambda t,p: requests.delete(c.url+'/rest/v1/'+t,headers=c.svc,params=p,timeout=30)
  requests.patch(c.url+'/rest/v1/setores',headers=c.svc,params={'chave':'eq.rh'},json={'ativo':True,'nome':'RH','icone':'users'},timeout=30)
  d('setores',{'chave':'eq.qualidade'}); d('midia_login',{'arquivo_path':f'like.{TAG}*'})
  d('registro_auditoria',{'tabela':'eq.setores','created_at':'gte.'+INICIO})
  ids=f'in.({V},{SU},{D},{AD})'; d('clientes',{'id':'eq.'+C})
  for uid in c.auth: requests.delete(c.url+'/auth/v1/admin/users/'+uid,headers=c.svc,timeout=30)
  d('user_roles',{'user_id':'in.('+','.join(c.auth or [str(uuid.uuid4())])+')'})
  for f in ['vendedor_id','usuario_id','registro_id']: d('registro_auditoria',{f:ids})
  d('registro_auditoria',{'tabela':'eq.midia_login','created_at':'gte.'+INICIO})
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('usuario_setores','usuario_id'),('usuarios','id')]: d(t,{f:ids})
 def rest(s,who,m,t,**k): return requests.request(m,s.url+'/rest/v1/'+t,headers=s.h[who],timeout=30,**k)
 def rpc(s,who,fn,body): return s.rest(who,'POST','rpc/'+fn,json=body)
 def recusa(s,r): s.assertFalse(r.ok,r.text)
 def test_1_dados_iniciais(s):
  rows={r['chave']:r for r in s.rest(AD,'GET','setores').json()}
  s.assertGreaterEqual(len(rows),10); s.assertTrue(rows['comercial']['disponivel'])
  for k in ['rh','financeiro','faturamento','logistica','supervisao','diretoria','compras','fiscal','contabilidade']:
   s.assertFalse(rows[k]['disponivel']); s.assertTrue(rows[k]['ativo'])
 def test_2_leitura(s):
  for u in [V,SU,D,AD]: s.assertGreaterEqual(len(s.rest(u,'GET','setores').json()),10)
  r=s.rest('anon','GET','setores'); s.assertTrue(not r.ok or r.json()==[])
 def test_3_escrita_direta(s):
  for u in [V,AD]:
   s.recusa(s.rest(u,'POST','setores',json={'chave':'xteste','nome':'X teste'}))
   r=s.rest(u,'PATCH','setores',params={'chave':'eq.rh'},json={'disponivel':True}); s.assertTrue(not r.ok or r.json()==[])
   r=s.rest(u,'DELETE','setores',params={'chave':'eq.fiscal'}); s.assertTrue(not r.ok or r.json()==[])
  s.assertFalse(s.get('setores',{'chave':'eq.rh'})[0]['disponivel']); s.assertEqual(len(s.get('setores',{'chave':'eq.fiscal'})),1)
 def test_4_nao_admin(s):
  for u in [V,SU,D]:
   s.assertEqual(s.rpc(u,'admin_criar_setor',{'_chave':'qualidade','_nome':'Qualidade'}).json().get('code'),'42501')
   s.assertEqual(s.rpc(u,'admin_atualizar_setor',{'_chave':'rh','_dados':{'nome':'X'}}).json().get('code'),'42501')
  s.recusa(s.rpc('anon','admin_criar_setor',{'_chave':'qualidade','_nome':'Qualidade'}))
  s.recusa(s.rpc('anon','admin_atualizar_setor',{'_chave':'rh','_dados':{'ativo':False}}))
 def test_5_admin_e_6_invalidos(s):
  r=s.rpc(AD,'admin_criar_setor',{'_chave':'qualidade','_nome':'Qualidade','_icone':'clipboard-check'}); s.assertTrue(r.ok,r.text)
  q=s.get('setores',{'chave':'eq.qualidade'})[0]; s.assertTrue(q['ativo']); s.assertFalse(q['disponivel'])
  s.assertTrue(s.rpc(AD,'admin_atualizar_setor',{'_chave':'qualidade','_dados':{'nome':'Qualidade Total'}}).ok)
  s.assertEqual(s.get('setores',{'chave':'eq.qualidade'})[0]['nome'],'Qualidade Total')
  s.assertTrue(s.rpc(AD,'admin_atualizar_setor',{'_chave':'qualidade','_dados':{'ativo':False}}).ok)
  s.assertFalse(s.get('setores',{'chave':'eq.qualidade'})[0]['ativo'])
  aud={a['acao']:a for a in s.get('registro_auditoria',{'tabela':'eq.setores','detalhes->>chave':'eq.qualidade'})}
  s.assertEqual(set(aud),{'setor_criado','setor_alterado','setor_ativacao'})
  for a in ['setor_alterado','setor_ativacao']: s.assertIn('antigo',aud[a]['detalhes']); s.assertIn('novo',aud[a]['detalhes'])
  s.assertEqual(aud['setor_alterado']['detalhes']['novo']['nome'],'Qualidade Total')
  for ch in ['RH!','1x','',None]: s.recusa(s.rpc(AD,'admin_criar_setor',{'_chave':ch,'_nome':'Valido X'}))
  for nm in ['',' ','a'*61]: s.recusa(s.rpc(AD,'admin_criar_setor',{'_chave':'novo_x','_nome':nm}))
  s.recusa(s.rpc(AD,'admin_criar_setor',{'_chave':'novo_x','_nome':'Novo X','_icone':'foguete'}))
  s.recusa(s.rpc(AD,'admin_criar_setor',{'_chave':'comercial','_nome':'Outro nome'}))
  for nm in ['  comercial ','COMERCIAL']: s.recusa(s.rpc(AD,'admin_criar_setor',{'_chave':'novo_x','_nome':nm}))
  for dd in [{'disponivel':True},{'chave':'x'},{'ativo':'sim'},{'nome':''},{'nome':'a'*61},{'icone':'foguete'},{'nome':'Comercial'}]:
   s.recusa(s.rpc(AD,'admin_atualizar_setor',{'_chave':'qualidade','_dados':dd}))
  s.recusa(s.rpc(AD,'admin_atualizar_setor',{'_chave':'nao_existe','_dados':{'nome':'Nada aqui'}}))
  s.assertEqual(s.get('setores',{'chave':'eq.novo_x'}),[]); s.assertFalse(s.get('setores',{'chave':'eq.qualidade'})[0]['disponivel'])
 def test_7_sem_exclusao(s):
  r=s.rest(AD,'DELETE','setores',params={'chave':'eq.rh'}); s.assertTrue(not r.ok or r.json()==[])
  s.recusa(s.rpc(AD,'admin_excluir_setor',{'_chave':'rh'}))
  s.assertEqual(len(s.get('setores',{'chave':'eq.rh'})),1)
 def test_8_desativar_mantem_acesso(s):
  antes=len(s.rest(V,'GET','clientes').json()); s.assertGreaterEqual(antes,1)
  s.assertTrue(s.rpc(AD,'admin_atualizar_setor',{'_chave':'rh','_dados':{'ativo':False}}).ok)
  s.assertTrue(s.get('usuario_setores',{'usuario_id':'eq.'+V,'setor':'eq.rh'})[0]['ativo'])
  s.assertIn('rh',s.rpc(V,'meus_setores',{}).json())
  s.assertEqual(len(s.rest(V,'GET','clientes').json()),antes)
  s.assertTrue(s.rpc(AD,'admin_atualizar_setor',{'_chave':'rh','_dados':{'ativo':True}}).ok)
 def test_9_midia_login(s):
  p={'id':'eq.'+s.midia}
  r=s.rest(AD,'PATCH','midia_login',params=p,json={'enquadramento':'ajustar','foco_x':20,'foco_y':80}); s.assertTrue(r.ok,r.text); s.assertEqual(len(r.json()),1)
  for b in [{'enquadramento':'cortar'},{'foco_x':101},{'foco_y':-1}]: s.recusa(s.rest(AD,'PATCH','midia_login',params=p,json=b))
  r=s.rest(V,'PATCH','midia_login',params=p,json={'foco_x':10}); s.assertTrue(not r.ok or r.json()==[])
  m=[x for x in s.rest('anon','GET','midia_login').json() if x['id']==s.midia][0]
  s.assertEqual((m['enquadramento'],m['foco_x'],m['foco_y']),('ajustar',20,80))
if __name__=='__main__': unittest.main(verbosity=2)
