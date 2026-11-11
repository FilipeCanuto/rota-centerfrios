"""Ficha 360, etiquetas e notas: regressão autenticada com fixtures temporárias."""
import os,secrets,unittest,uuid
from pathlib import Path
import requests
A,B=str(uuid.uuid4()),str(uuid.uuid4()); CA,CB=str(uuid.uuid4()),str(uuid.uuid4()); VA=str(uuid.uuid4())
class Ficha(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.svc={'apikey':key,'Content-Type':'application/json'}
  if not key.startswith('sb_'): cls.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.auth=[]; cls.h={}; cls.addClassCleanup(cls.cleanup)
  emp=cls.get('empresas',{'nome':'eq.CENTERFRIOS'})[0]['id']; cls.emp=emp
  for uid,n in [(A,'a'),(B,'b')]:
   cls.ins('usuarios',{'id':uid,'nome':'Ficha '+n,'email':f'ficha.{n}.teste@centerfrios.com','empresa_id':emp})
   cls.ins('usuario_empresas',{'usuario_id':uid,'empresa_id':emp}); cls.ins('papeis_pre_cadastro',{'usuario_id':uid,'role':'vendedor','empresa_id':emp})
  cls.ins('clientes',{'id':CA,'empresa_id':emp,'vendedor_id':A,'nome':'Cliente Ficha A'}); cls.ins('clientes',{'id':CB,'empresa_id':emp,'vendedor_id':B,'nome':'Cliente Ficha B'})
  cls.ins('vendas',{'id':VA,'empresa_id':emp,'vendedor_id':A,'cliente_id':CA,'data_faturamento':'2026-11-05','valor':500,'codigo_shop9':'NF-TESTE-1'})
  cls.ins('itens_venda',{'empresa_id':emp,'venda_id':VA,'cliente_id':CA,'vendedor_id':A,'produto':'Freezer','quantidade':2,'valor_total':500})
  cls.ins('orcamentos',{'empresa_id':emp,'vendedor_id':A,'cliente_id':CA,'status':'aberto','data':'2026-11-06','valor':900})
  cls.ins('interacoes',{'empresa_id':emp,'vendedor_id':A,'cliente_id':CA,'tipo':'visita','cliente_respondeu':True,'resultado':'ok','data':'2026-11-10T23:30:00-03:00'})
  for uid,n in [(A,'a'),(B,'b')]:
   email=f'ficha.{n}.teste@centerfrios.com'; pw=secrets.token_urlsafe(32)
   r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.svc,json={'email':email,'password':pw,'email_confirm':True},timeout=30); r.raise_for_status(); cls.auth.append(r.json()['id'])
   r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.pub,json={'email':email,'password':pw},timeout=30); r.raise_for_status()
   cls.h[uid]={**cls.pub,'Authorization':'Bearer '+r.json()['access_token'],'Content-Type':'application/json','Prefer':'return=representation'}
 @classmethod
 def get(cls,t,p): r=requests.get(cls.url+'/rest/v1/'+t,headers=cls.svc,params=p,timeout=30); r.raise_for_status(); return r.json()
 @classmethod
 def ins(cls,t,d): r=requests.post(cls.url+'/rest/v1/'+t,headers=cls.svc,json=d,timeout=30); assert r.ok,r.text
 @classmethod
 def cleanup(cls):
  for uid in cls.auth: requests.delete(cls.url+'/auth/v1/admin/users/'+uid,headers=cls.svc,timeout=30)
  for t,f in [('notas_cliente','cliente_id'),('itens_venda','cliente_id'),('interacoes','cliente_id'),('orcamentos','cliente_id'),('vendas','cliente_id')]:
   requests.delete(cls.url+f'/rest/v1/{t}',headers=cls.svc,params={f:f'in.({CA},{CB})'},timeout=30)
  requests.delete(cls.url+'/rest/v1/clientes',headers=cls.svc,params={'id':f'in.({CA},{CB})'},timeout=30)
  for t in ['user_roles']: requests.delete(cls.url+'/rest/v1/'+t,headers=cls.svc,params={'user_id':'in.('+','.join(cls.auth or [str(uuid.uuid4())])+')'},timeout=30)
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('registro_auditoria','vendedor_id'),('registro_auditoria','usuario_id'),('usuarios','id')]:
   requests.delete(cls.url+f'/rest/v1/{t}',headers=cls.svc,params={f:f'in.({A},{B})'},timeout=30)
 def patch(self,who,t,id,d): return requests.patch(self.url+'/rest/v1/'+t,headers=self.h[who],params={'id':'eq.'+id},json=d,timeout=30)
 def ficha(self,who,c): r=requests.post(self.url+'/rest/v1/rpc/ficha_cliente',headers=self.h[who],json={'_cliente_id':c,'_hoje':'2026-11-11'},timeout=30); self.assertTrue(r.ok,r.text); return r.json()
 def test_1_etiquetas(self):
  r=self.patch(A,'clientes',CA,{'etiquetas':['vip']}); self.assertTrue(r.ok,r.text); self.assertEqual(r.json()[0]['etiquetas'],['vip'])
  r=self.patch(A,'clientes',CB,{'etiquetas':['x']}); self.assertTrue(r.ok); self.assertEqual(r.json(),[])
  r=self.patch(A,'clientes',CA,{'nome':'Outro'}); self.assertEqual(r.status_code,403)
 def test_2_orcamento_followup(self):
  r=requests.patch(self.url+'/rest/v1/orcamentos',headers=self.h[A],params={'cliente_id':'eq.'+CA},json={'proximo_followup':'2026-11-20','observacao':'ligar'},timeout=30); self.assertTrue(r.ok,r.text); self.assertEqual(len(r.json()),1)
 def test_3_ficha(self):
  f=self.ficha(A,CA)
  for k in ['cliente','compras','total_12m','qtd_12m','ticket_medio_12m','itens_mais_comprados','orcamentos','interacoes','notas']: self.assertIn(k,f)
  self.assertEqual(f['total_12m'],500); self.assertEqual(f['compras'][0]['itens'][0]['produto'],'Freezer'); self.assertEqual(f['itens_mais_comprados'][0]['quantidade'],2)
  self.assertEqual(f['interacoes'][0]['dia_local'],'2026-11-10')
  self.assertIsNone(self.ficha(A,CB))
 def test_4_notas(self):
  r=requests.post(self.url+'/rest/v1/notas_cliente',headers=self.h[A],json={'empresa_id':self.emp,'cliente_id':CA,'vendedor_id':A,'texto':'Prefere entrega pela manhã'},timeout=30); self.assertTrue(r.ok,r.text); nid=r.json()[0]['id']
  self.assertEqual(self.ficha(A,CA)['notas'][0]['autor_nome'],'Ficha a')
  r=requests.post(self.url+'/rest/v1/notas_cliente',headers=self.h[B],json={'empresa_id':self.emp,'cliente_id':CA,'vendedor_id':A,'texto':'intrusa'},timeout=30); self.assertEqual(r.status_code,403)
  r=requests.delete(self.url+'/rest/v1/notas_cliente',headers=self.h[B],params={'id':'eq.'+nid},timeout=30); self.assertEqual(r.json(),[])
  r=requests.delete(self.url+'/rest/v1/notas_cliente',headers=self.h[A],params={'id':'eq.'+nid},timeout=30); self.assertEqual(len(r.json()),1)
if __name__=='__main__': unittest.main()
