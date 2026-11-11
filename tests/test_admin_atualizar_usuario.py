"""Authenticated identity-protection regression; fixture invitations use data tools."""
import json,os,secrets,unittest
from pathlib import Path
import requests
ADMIN='66666666-6666-4666-8666-666666666101'
SELLER='66666666-6666-4666-8666-666666666102'
INVITE='66666666-6666-4666-8666-666666666103'
class AdminUpdate(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.service={'apikey':key}
  if not key.startswith('sb_'): cls.service['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.public={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.accounts={}; cls.addClassCleanup(cls.cleanup)
  for role in ['admin','vendedor']:
   email='seguranca.'+role+'.teste@centerfrios.com'; password=secrets.token_urlsafe(32)
   r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.service,json={'email':email,'password':password,'email_confirm':True},timeout=30)
   if not r.ok: raise RuntimeError('Falha na criação da conta temporária')
   cls.accounts[role]={'id':r.json()['id']}
   r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.public,json={'email':email,'password':password},timeout=30)
   if not r.ok: raise RuntimeError('Falha na autenticação temporária')
   cls.accounts[role]['headers']={**cls.public,'Authorization':'Bearer '+r.json()['access_token']}
 @classmethod
 def cleanup(cls):
  for account in cls.accounts.values():
   r=requests.delete(cls.url+'/auth/v1/admin/users/'+account['id'],headers=cls.service,timeout=30)
   if not r.ok: raise RuntimeError('Falha na remoção da conta temporária')
 def rpc(self,data,target=SELLER,role='admin'):
  return requests.post(self.url+'/rest/v1/rpc/admin_atualizar_usuario',headers=self.accounts[role]['headers'],json={'_usuario_id':target,'_dados':data},timeout=30)
 def rows(self,table,params,role=None):
  r=requests.get(self.url+'/rest/v1/'+table,headers=self.accounts[role]['headers'] if role else self.service,params=params,timeout=30)
  self.assertTrue(r.ok,r.text[:500]); return r.json()
 def forbidden(self,data):
  before=self.rows('usuarios',{'id':'eq.'+SELLER}); r=self.rpc(data)
  self.assertFalse(r.ok); self.assertEqual(r.json()['message'],'Campo de usuário não permitido.')
  self.assertEqual(self.rows('usuarios',{'id':'eq.'+SELLER}),before)
 def test_01_auth_user_id_recusado(self): self.forbidden({'auth_user_id':ADMIN})
 def test_02_created_at_recusado(self): self.forbidden({'created_at':'2020-01-01'})
 def test_03_demo_recusado(self): self.forbidden({'demo':True})
 def test_04_outro_campo_recusado(self): self.forbidden({'perfil':'administrador'})
 def test_05_alteracao_auditada(self):
  before=self.rows('usuarios',{'id':'eq.'+SELLER})[0]
  r=self.rpc({'nome':'Novo nome','equipe_id':None}); self.assertTrue(r.ok,r.text[:500])
  after=r.json(); self.assertEqual(after['nome'],'Novo nome'); self.assertIsNone(after['equipe_id'])
  for field in ['auth_user_id','created_at','demo']: self.assertEqual(after[field],before[field])
  rows=self.rows('registro_auditoria',{'registro_id':'eq.'+SELLER,'acao':'eq.alteracao_usuario'},role='admin')
  self.assertEqual(len(rows),1); self.assertEqual(rows[0]['usuario_id'],ADMIN)
  self.assertEqual(rows[0]['detalhes'],{'antigo':before,'novo':after}); self.assertEqual(rows[0]['tabela'],'usuarios')
 def test_06_email_login_recusado(self):
  before=self.rows('usuarios',{'id':'eq.'+SELLER}); r=self.rpc({'email':'outra.conta@centerfrios.com'})
  self.assertFalse(r.ok); self.assertEqual(r.json()['message'],'Não é possível trocar o e-mail de um usuário que já tem login.')
  self.assertEqual(self.rows('usuarios',{'id':'eq.'+SELLER}),before)
 def test_07_email_convite_permitido(self):
  r=self.rpc({'email':'convite.novo@centerfrios.com'},INVITE); self.assertTrue(r.ok,r.text[:500]); self.assertEqual(r.json()['email'],'convite.novo@centerfrios.com'); self.assertIsNone(r.json()['auth_user_id'])
  rows=self.rows('registro_auditoria',{'registro_id':'eq.'+INVITE,'acao':'eq.alteracao_usuario'},role='admin')
  self.assertEqual(len(rows),1); self.assertEqual(rows[0]['detalhes']['antigo']['email'],'seguranca.convite.teste@centerfrios.com'); self.assertEqual(rows[0]['detalhes']['novo']['email'],'convite.novo@centerfrios.com')
 def test_08_vendedor_recusado(self):
  r=self.rpc({'nome':'Proibido'},role='vendedor'); self.assertEqual(r.status_code,403); self.assertEqual(r.json()['code'],'42501')
 def test_09_recusas_sem_auditoria(self):
  rows=self.rows('registro_auditoria',{'acao':'eq.alteracao_usuario','usuario_id':'eq.'+ADMIN})
  self.assertEqual(len(rows),2)
if __name__=='__main__': unittest.main()