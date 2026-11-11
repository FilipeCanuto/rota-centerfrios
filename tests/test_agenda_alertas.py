"""Agenda e tarefas dos alertas: regressão autenticada com fixtures temporárias."""
import os,secrets,unittest,uuid
from pathlib import Path
import requests
A,B=str(uuid.uuid4()),str(uuid.uuid4()); CA1,CA2,CB=(str(uuid.uuid4()) for _ in range(3))
class Agenda(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.svc={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'}
  if not key.startswith('sb_'): cls.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.auth=[]; cls.h={}; cls.addClassCleanup(cls.cleanup)
  cls.emp=emp=cls.get('empresas',{'nome':'eq.CENTERFRIOS'})[0]['id']
  for uid,n in [(A,'a'),(B,'b')]:
   cls.ins('usuarios',{'id':uid,'nome':'Agenda '+n,'email':f'agenda.{n}.teste@centerfrios.com','empresa_id':emp})
   cls.ins('usuario_empresas',{'usuario_id':uid,'empresa_id':emp}); cls.ins('papeis_pre_cadastro',{'usuario_id':uid,'role':'vendedor','empresa_id':emp})
  for c,v in [(CA1,A),(CA2,A),(CB,B)]: cls.ins('clientes',{'id':c,'empresa_id':emp,'vendedor_id':v,'nome':'Cliente agenda'})
  cls.tb=cls.ins('tarefas_agenda',{'empresa_id':emp,'vendedor_id':B,'titulo':'Tarefa de B','data':'2026-11-11'})[0]['id']
  for uid,n in [(A,'a'),(B,'b')]:
   email=f'agenda.{n}.teste@centerfrios.com'; pw=secrets.token_urlsafe(32)
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
  d('tarefas_agenda',{'vendedor_id':f'in.({A},{B})'}); d('clientes',{'id':f'in.({CA1},{CA2},{CB})'})
  for uid in cls.auth: requests.delete(cls.url+'/auth/v1/admin/users/'+uid,headers=cls.svc,timeout=30)
  d('user_roles',{'user_id':'in.('+','.join(cls.auth or [str(uuid.uuid4())])+')'})
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('registro_auditoria','vendedor_id'),('usuarios','id')]: d(t,{f:f'in.({A},{B})'})
 def gerar(self,itens): r=requests.post(self.url+'/rest/v1/rpc/gerar_tarefas_dos_alertas',headers=self.h[A],json={'_itens':itens},timeout=30); self.assertTrue(r.ok,r.text); return r.json()
 def test_1_gerar(self):
  it=[{'empresa_id':self.emp,'cliente_id':CA1,'motivo_alerta':'recompra_urgente','titulo':'Ligar para recompra'},{'empresa_id':self.emp,'cliente_id':CA2,'motivo_alerta':'esquecido','titulo':'Retomar contato'}]
  self.assertEqual(self.gerar(it),2); self.assertEqual(self.gerar(it),0)
  self.assertEqual({t['tipo'] for t in self.get('tarefas_agenda',{'vendedor_id':'eq.'+A,'motivo_alerta':'not.is.null'})},{'retorno'})
 def test_2_outro(self):
  self.assertEqual(self.gerar([{'empresa_id':self.emp,'cliente_id':CB,'motivo_alerta':'sem_compra','titulo':'x'}]),0)
  r=requests.post(self.url+'/rest/v1/tarefas_agenda',headers=self.h[A],json={'empresa_id':self.emp,'vendedor_id':A,'cliente_id':CB,'titulo':'x','data':'2026-11-12'},timeout=30); self.assertEqual(r.status_code,403,r.text)
 def test_3_concluir(self):
  t=requests.post(self.url+'/rest/v1/tarefas_agenda',headers=self.h[A],json={'empresa_id':self.emp,'vendedor_id':A,'titulo':'Minha','data':'2026-11-11'},timeout=30).json()[0]['id']
  r=requests.patch(self.url+'/rest/v1/tarefas_agenda',headers=self.h[A],params={'id':'eq.'+t},json={'concluida':True,'concluida_em':'2026-11-11T14:00:00-03:00'},timeout=30); self.assertTrue(r.ok,r.text); self.assertTrue(r.json()[0]['concluida'])
  r=requests.patch(self.url+'/rest/v1/tarefas_agenda',headers=self.h[A],params={'id':'eq.'+self.tb},json={'concluida':True},timeout=30); self.assertEqual(r.json(),[])
  r=requests.patch(self.url+'/rest/v1/tarefas_agenda',headers=self.h[A],params={'id':'eq.'+t},json={'vendedor_id':B},timeout=30); self.assertEqual(r.status_code,403)
 def test_4_manual(self):
  r=requests.post(self.url+'/rest/v1/tarefas_agenda',headers=self.h[A],json={'empresa_id':self.emp,'vendedor_id':A,'cliente_id':CA1,'titulo':'Visitar loja','data':'2026-11-13','hora':'09:30','tipo':'visita','observacao':'levar catálogo'},timeout=30)
  self.assertTrue(r.ok,r.text); j=r.json()[0]; self.assertEqual((j['tipo'],j['hora'],j['motivo_alerta']),('visita','09:30:00',None))
if __name__=='__main__': unittest.main()
