"""Mensagem 20: catálogo, carrinho, descontos, orçamento da Rota e fila Shop9, com usuários temporários e JWT de cada um."""
import os,secrets,unittest,uuid,time,threading,datetime
from pathlib import Path
import requests
V1,V2,V3,S,D,A=(str(uuid.uuid4()) for _ in range(6)); EQ=str(uuid.uuid4())
CL={k:str(uuid.uuid4()) for k in ['C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','C11','CX']}
TAG=secrets.token_hex(3).upper(); COD='ORC-T'+TAG
P=lambda s:f'T{TAG}{s}'
ST={}
class Carrinho(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.svc={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'}
  if not key.startswith('sb_'): cls.svc['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.pub={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.auth=[]; cls.h={}; cls.addClassCleanup(cls.cleanup)
  cls.emp=emp=cls.get('empresas',{'nome':'eq.CENTERFRIOS'})[0]['id']
  users=[(V1,'v1','vendedor',True),(V2,'v2','vendedor',True),(V3,'v3','vendedor',False),(S,'s','supervisor',True),(D,'d','diretoria',True),(A,'a','administrador',True)]
  for uid,n,role,setor in users:
   cls.ins('usuarios',{'id':uid,'nome':'Carrinho '+n,'email':f'carrinho.{n}.teste@centerfrios.com','empresa_id':emp})
   cls.ins('usuario_empresas',{'usuario_id':uid,'empresa_id':emp}); cls.ins('papeis_pre_cadastro',{'usuario_id':uid,'role':role,'empresa_id':None if role=='diretoria' else emp})
   if setor: cls.ins('usuario_setores',{'usuario_id':uid,'setor':'comercial'})
  cls.ins('equipes',{'id':EQ,'empresa_id':emp,'nome':'Equipe teste carrinho','supervisor_id':S})
  for v in (V1,V2): requests.patch(cls.url+'/rest/v1/usuarios',headers=cls.svc,params={'id':'eq.'+v},json={'equipe_id':EQ},timeout=30).raise_for_status()
  for k,cid in CL.items():
   dono=V2 if k in ('C10','C11') else (V3 if k=='CX' else V1)
   cls.ins('clientes',{'id':cid,'empresa_id':emp,'vendedor_id':dono,'nome':'Cliente '+k,'codigo_shop9':P('CLI'+k)})
  cls.prod={}
  for c,d,pr in [('Q1','Item trinta e três',33.33),('Q2','Item um real A',1),('Q3','Item um real B',1)]:
   cls.prod[c]=cls.ins('produtos',{'empresa_id':emp,'codigo_shop9':P(c),'descricao':d,'preco_tabela':pr})[0]['id']
  for uid,n,*_ in users:
   email=f'carrinho.{n}.teste@centerfrios.com'; pw=secrets.token_urlsafe(32)
   r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.svc,json={'email':email,'password':pw,'email_confirm':True},timeout=30); r.raise_for_status(); cls.auth.append(r.json()['id'])
   r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.pub,json={'email':email,'password':pw},timeout=30); r.raise_for_status()
   cls.h[uid]={**cls.pub,'Authorization':'Bearer '+r.json()['access_token'],'Content-Type':'application/json','Prefer':'return=representation'}
  cls.motivos={m['texto']:m['id'] for m in cls.get('motivos_cancelamento_carrinho',{'empresa_id':'eq.'+emp})}
 @classmethod
 def get(cls,t,p): r=requests.get(cls.url+'/rest/v1/'+t,headers=cls.svc,params=p,timeout=30); r.raise_for_status(); return r.json()
 @classmethod
 def ins(cls,t,d): r=requests.post(cls.url+'/rest/v1/'+t,headers=cls.svc,json=d,timeout=30); assert r.ok,r.text; return r.json()
 @classmethod
 def cleanup(cls):
  d=lambda t,p: requests.delete(cls.url+'/rest/v1/'+t,headers=cls.svc,params=p,timeout=30)
  ids='in.('+','.join([V1,V2,V3,S,D,A])+')'
  orcs=[o['id'] for o in cls.get('orcamentos',{'vendedor_id':ids,'select':'id'})]
  if orcs: d('shop9_envios',{'orcamento_id':'in.('+','.join(orcs)+')'})
  requests.patch(cls.url+'/rest/v1/carrinhos',headers=cls.svc,params={'vendedor_id':ids},json={'orcamento_id':None},timeout=30)
  d('orcamentos',{'vendedor_id':ids}); d('liberacoes_desconto',{'vendedor_id':ids}); d('carrinhos',{'vendedor_id':ids}); d('limites_desconto',{'vendedor_id':ids})
  d('itens_venda',{'vendedor_id':ids}); d('vendas',{'vendedor_id':ids}); d('clientes',{'vendedor_id':ids})
  d('produtos',{'codigo_shop9':f'like.T{TAG}*'}); d('importacoes',{'usuario_id':ids})
  for uid in cls.auth: requests.delete(cls.url+'/auth/v1/admin/users/'+uid,headers=cls.svc,timeout=30)
  d('user_roles',{'user_id':'in.('+','.join(cls.auth or [str(uuid.uuid4())])+')'})
  requests.patch(cls.url+'/rest/v1/usuarios',headers=cls.svc,params={'id':ids},json={'equipe_id':None},timeout=30); d('equipes',{'id':'eq.'+EQ})
  for f in ['vendedor_id','usuario_id','registro_id']: d('registro_auditoria',{f:ids})
  for t,f in [('papeis_pre_cadastro','usuario_id'),('usuario_empresas','usuario_id'),('usuario_setores','usuario_id'),('usuarios','id')]: d(t,{f:ids})
 def q(self,who,t,p=None): return requests.get(self.url+'/rest/v1/'+t,headers=self.h[who],params=p or {'select':'*'},timeout=30)
 def rpc(self,who,fn,body): return requests.post(self.url+'/rest/v1/rpc/'+fn,headers=self.h[who],json=body,timeout=60)
 def code(self,r): return None if r.ok else r.json().get('code')
 def ok(self,r): self.assertTrue(r.ok,r.text); return r.json() if r.text.strip() else None
 def abrir(self,who,c): return self.rpc(who,'abrir_carrinho',{'_cliente_id':CL[c]})
 def add(self,who,k,p,q,d=0): return self.rpc(who,'adicionar_item_carrinho',{'_carrinho_id':k,'_produto_id':self.prod[p],'_quantidade':q,'_desconto_pct':d})
 def cancelar(self,who,k,m='Preço',t=None): return self.rpc(who,'cancelar_carrinho',{'_carrinho_id':k,'_motivo_id':self.motivos.get(m),'_texto':t})
 def abertos(self): return self.get('carrinhos',{'vendedor_id':'eq.'+V1,'estado':'eq.aberto','select':'id,cliente_id'})
 def amanha(self): return (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=1)).isoformat()

 def test_01_catalogo(self):
  linhas=[{'linha':2,'codigo_shop9':P('P1'),'descricao':'Freezer horizontal 500L','unidade':'UN','preco_tabela':'2999,90','ativo':'sim'},
          {'linha':3,'codigo_shop9':P('P10'),'descricao':'Peça de reposição','unidade':'UN','preco_tabela':'10','ativo':'sim'},
          {'linha':4,'codigo_shop9':P('P9'),'descricao':'Ruim','unidade':'UN','preco_tabela':'abc','ativo':'sim'}]
  r=self.ok(self.rpc(D,'importar_produtos',{'_empresa_id':self.emp,'_arquivo':'p.xlsx','_linhas':linhas}))
  self.assertEqual((r['inseridas'],r['atualizadas'],len(r['erros'])),(2,0,1)); self.assertEqual(r['erros'][0]['linha'],4)
  r=self.ok(self.rpc(D,'importar_produtos',{'_empresa_id':self.emp,'_arquivo':'p.xlsx','_linhas':linhas}))
  self.assertEqual((r['inseridas'],r['atualizadas']),(0,2))
  self.assertTrue(self.ok(self.q(V1,'produtos',{'select':'id','codigo_shop9':'eq.'+P('P1')})))
  achou=self.ok(self.rpc(V1,'buscar_produtos',{'_empresa_id':self.emp,'_termo':'frezer'}))
  self.assertIn(P('P1'),[x['codigo_shop9'] for x in achou])
  achou=self.ok(self.rpc(V1,'buscar_produtos',{'_empresa_id':self.emp,'_termo':P('P1')}))
  self.assertEqual([x['codigo_shop9'] for x in achou][:2],[P('P1'),P('P10')])
  self.assertFalse(requests.post(self.url+'/rest/v1/produtos',headers=self.h[V1],json={'empresa_id':self.emp,'codigo_shop9':P('Z'),'descricao':'x','preco_tabela':1},timeout=30).ok)
  self.assertFalse(requests.patch(self.url+'/rest/v1/produtos',headers=self.h[V1],params={'codigo_shop9':'eq.'+P('P1')},json={'preco_tabela':1},timeout=30).ok)
  self.assertFalse(requests.delete(self.url+'/rest/v1/produtos',headers=self.h[V1],params={'codigo_shop9':'eq.'+P('P1')},timeout=30).ok)
  self.assertEqual(self.code(self.rpc(V1,'importar_produtos',{'_empresa_id':self.emp,'_arquivo':'p','_linhas':[]})),'42501')

 def test_02_comprados(self):
  for i,(dia,cod) in enumerate([('2026-09-01',P('X')),('2026-10-01',P('X')),('2026-11-01',P('Y'))]):
   v=self.ins('vendas',{'empresa_id':self.emp,'cliente_id':CL['C1'],'vendedor_id':V1,'data_faturamento':dia,'valor':10})[0]['id']
   self.ins('itens_venda',{'empresa_id':self.emp,'venda_id':v,'cliente_id':CL['C1'],'vendedor_id':V1,'produto':'Prod '+cod,'codigo_produto':cod,'quantidade':1,'valor_total':10})
  r=self.ok(self.rpc(V1,'produtos_comprados',{'_cliente_id':CL['C1']}))
  self.assertEqual([(x['codigo_shop9'],x['vezes']) for x in r],[(P('Y'),1),(P('X'),2)])

 def test_03_limite(self):
  ids=[self.ok(self.abrir(V1,c)) for c in ('C1','C2','C3')]
  self.assertEqual(self.code(self.abrir(V1,'C4')),'P0001')
  self.assertIn('3 carrinhos abertos',self.abrir(V1,'C4').json()['message'])
  self.assertEqual(self.ok(self.abrir(V1,'C1')),ids[0])
  self.ok(self.cancelar(V1,ids[2])); k4=self.ok(self.abrir(V1,'C4'))
  ST['K1'],ST['K2'],ST['K4']=ids[0],ids[1],k4

 def test_04_corrida(self):
  self.ok(self.cancelar(V1,ST['K4'])); self.assertEqual(len(self.abertos()),2)
  res=[None]*5
  def go(i,c): res[i]=self.abrir(V1,c)
  ts=[threading.Thread(target=go,args=(i,c)) for i,c in enumerate(['C5','C6','C7','C8','C9'])]
  [t.start() for t in ts]; [t.join() for t in ts]
  oks=[r for r in res if r.ok]; self.assertEqual(len(oks),1,[r.text for r in res])
  self.assertEqual(sorted(self.code(r) for r in res if not r.ok),['P0001']*4); self.assertEqual(len(self.abertos()),3)
  self.ok(self.cancelar(V1,oks[0].json()))
  res=[None]*2; ts=[threading.Thread(target=go,args=(i,'C5')) for i in range(2)]
  [t.start() for t in ts]; [t.join() for t in ts]
  self.assertTrue(all(r.ok for r in res),[r.text for r in res]); self.assertEqual(res[0].json(),res[1].json())
  self.assertEqual(len(self.get('carrinhos',{'vendedor_id':'eq.'+V1,'cliente_id':'eq.'+CL['C5'],'estado':'eq.aberto'})),1)
  ST['K5']=res[0].json()

 def test_05_totais(self):
  self.ok(self.rpc(D,'definir_limite_desconto',{'_vendedor_id':V2,'_empresa_id':self.emp,'_limite_pct':10}))
  ka=self.ok(self.abrir(V2,'C10')); item=self.ok(self.add(V2,ka,'Q1',3,10))
  self.assertEqual(float(self.get('itens_carrinho',{'id':'eq.'+item})[0]['total']),89.99)
  kb=self.ok(self.abrir(V2,'C11')); self.ok(self.add(V2,kb,'Q2',0.335)); self.ok(self.add(V2,kb,'Q3',0.335))
  self.assertEqual(float(self.get('carrinhos',{'id':'eq.'+kb})[0]['total']),0.68)
  requests.patch(self.url+'/rest/v1/produtos',headers=self.svc,params={'id':'eq.'+self.prod['Q1']},json={'preco_tabela':50},timeout=30).raise_for_status()
  self.ok(self.add(V2,ka,'Q1',1,10)); it=self.get('itens_carrinho',{'id':'eq.'+item})[0]
  self.assertEqual((float(it['preco_unit']),float(it['quantidade'])),(33.33,4.0))
  r=requests.patch(self.url+'/rest/v1/itens_carrinho',headers=self.h[V2],params={'id':'eq.'+item},json={'total':1},timeout=30); self.assertFalse(r.ok)
  self.assertNotEqual(float(self.get('itens_carrinho',{'id':'eq.'+item})[0]['total']),1)
  ST['KA'],ST['KB']=ka,kb

 def test_06_desconto(self):
  k=ST['K1']
  self.ok(self.add(V1,k,'Q2',1,5)); self.assertEqual(self.code(self.add(V1,k,'Q3',1,6)),'P0001')
  self.assertIn('peça liberação',self.add(V1,k,'Q3',1,6).json()['message'])
  lib=self.ok(self.rpc(V1,'solicitar_liberacao_desconto',{'_cliente_id':CL['C1'],'_desconto_pct':12,'_motivo':'Cliente grande'}))
  self.ok(self.rpc(S,'decidir_liberacao_desconto',{'_id':lib,'_aprovar':True,'_pct_aprovado':15,'_valida_ate':self.amanha()}))
  self.ok(self.add(V1,k,'Q3',1,12))
  lib2=self.ok(self.rpc(V1,'solicitar_liberacao_desconto',{'_cliente_id':CL['C1'],'_desconto_pct':20,'_motivo':'Negociação anual'}))
  self.assertEqual(self.code(self.rpc(S,'decidir_liberacao_desconto',{'_id':lib2,'_aprovar':True,'_pct_aprovado':20})),'P0001')
  self.ok(self.rpc(D,'decidir_liberacao_desconto',{'_id':lib2,'_aprovar':True,'_pct_aprovado':20}))
  self.assertEqual(self.code(self.rpc(S,'definir_limite_desconto',{'_vendedor_id':V1,'_empresa_id':self.emp,'_limite_pct':16})),'P0001')
  # liberação vencida (V2, limite 10)
  ka=ST['KA']; lv=self.ok(self.rpc(V2,'solicitar_liberacao_desconto',{'_cliente_id':CL['C10'],'_desconto_pct':12,'_motivo':'Teste vencida','_carrinho_id':ka}))
  ate=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=3)).isoformat()
  self.ok(self.rpc(S,'decidir_liberacao_desconto',{'_id':lv,'_aprovar':True,'_valida_ate':ate}))
  self.ok(self.add(V2,ka,'Q2',1,12)); time.sleep(5)
  self.assertEqual(self.code(self.rpc(V2,'concluir_carrinho',{'_carrinho_id':ka})),'P0001')
  self.ok(self.rpc(V2,'remover_item_carrinho',{'_item_id':self.get('itens_carrinho',{'carrinho_id':'eq.'+ka,'produto_id':'eq.'+self.prod['Q2']})[0]['id']}))
  lim=self.ok(self.rpc(D,'definir_limite_desconto',{'_vendedor_id':V1,'_empresa_id':self.emp,'_limite_pct':30,'_motivo':'Cliente estratégico'}))
  aud=self.get('registro_auditoria',{'registro_id':'eq.'+lim,'acao':'eq.alteracao_limite_desconto'})
  self.assertEqual((len(aud),float(aud[0]['detalhes']['antigo']),float(aud[0]['detalhes']['novo'])),(1,5.0,30.0))
  propria=self.ok(self.rpc(V1,'solicitar_liberacao_desconto',{'_cliente_id':CL['C1'],'_desconto_pct':40,'_motivo':'Própria decisão'}))
  self.assertEqual(self.code(self.rpc(V1,'decidir_liberacao_desconto',{'_id':propria,'_aprovar':True})),'42501')
  self.assertEqual(self.code(self.rpc(S,'definir_limite_desconto',{'_vendedor_id':V3,'_empresa_id':self.emp,'_limite_pct':5})),'42501')

 def test_07_concluir(self):
  k=ST['K1']; total=float(self.get('carrinhos',{'id':'eq.'+k})[0]['total'])
  orc=self.ok(self.rpc(V1,'concluir_carrinho',{'_carrinho_id':k}))
  o=self.ok(self.q(V1,'orcamentos',{'id':'eq.'+orc,'select':'origem_rota,status,envio_estado,valor'}))[0]
  self.assertEqual((o['origem_rota'],o['status'],o['envio_estado'],float(o['valor'])),(True,'aberto','pendente',total))
  self.assertEqual(len(self.get('itens_orcamento',{'orcamento_id':'eq.'+orc})),2)
  self.assertEqual(self.ok(self.rpc(V1,'concluir_carrinho',{'_carrinho_id':k})),orc)
  res=[None]*2
  def go(i): res[i]=self.rpc(V1,'concluir_carrinho',{'_carrinho_id':k})
  ts=[threading.Thread(target=go,args=(i,)) for i in range(2)]; [t.start() for t in ts]; [t.join() for t in ts]
  self.assertEqual([r.json() for r in res],[orc,orc])
  self.assertEqual(len(self.get('orcamentos',{'carrinho_id':'eq.'+k})),1); self.assertEqual(len(self.get('shop9_envios',{'orcamento_id':'eq.'+orc})),1)
  self.assertEqual(self.code(self.rpc(V1,'concluir_carrinho',{'_carrinho_id':ST['K2']})),'P0001')
  k5=ST['K5']
  self.assertEqual(self.code(self.cancelar(V1,k5,m=None)),'P0001'); self.assertEqual(self.code(self.cancelar(V1,k5,m='Outro')),'P0001')
  self.ok(self.cancelar(V1,k5,m='Outro',t='Cliente fechou a loja'))
  self.assertEqual(self.code(self.rpc(V1,'concluir_carrinho',{'_carrinho_id':k5})),'P0001')
  ST['ORC']=orc; ST['ORC2']=self.ok(self.rpc(V2,'concluir_carrinho',{'_carrinho_id':ST['KB']}))

 def test_08_envio_manual(self):
  orc=ST['ORC']; pend=self.ok(self.rpc(D,'shop9_pendentes',{'_empresa_id':self.emp}))
  self.assertIn(orc,[p['id'] for p in pend]); self.assertEqual(len(next(p for p in pend if p['id']==orc)['itens']),2)
  m=lambda who,o,c: self.rpc(who,'shop9_marcar_enviado',{'_orcamento_id':o,'_codigo_shop9':c})
  self.ok(m(D,orc,COD)); self.ok(m(D,orc,COD))
  self.assertEqual(self.code(m(D,orc,COD+'X')),'P0001'); self.assertEqual(self.code(m(D,ST['ORC2'],COD)),'P0001')
  self.assertEqual(self.code(m(V1,orc,COD)),'42501'); self.assertEqual(self.code(self.rpc(V1,'shop9_pendentes',{'_empresa_id':self.emp})),'42501')
  r=self.ok(self.rpc(D,'importar_orcamentos',{'_empresa_id':self.emp,'_arquivo':'o.xlsx','_linhas':[{'linha':2,'codigo_shop9':COD,'status':'ganho','valor':'123.45','cliente_codigo':P('CLIC1'),'data':'2026-11-16'}]}))
  self.assertEqual((r['inseridas'],r['atualizadas']),(0,1))
  os_=self.get('orcamentos',{'codigo_shop9':'eq.'+COD,'empresa_id':'eq.'+self.emp})
  self.assertEqual([(o['id'],o['envio_estado'],o['status']) for o in os_],[(orc,'confirmado','ganho')])

 def test_09_fila(self):
  env=self.get('shop9_envios',{'orcamento_id':'eq.'+ST['ORC2']})[0]['id']; body={'_envio_id':env,'_ok':False,'_erro':'timeout'}
  for _ in range(2): r=requests.post(self.url+'/rest/v1/rpc/shop9_registrar_tentativa',headers=self.svc,json=body,timeout=30); self.assertTrue(r.ok,r.text)
  e=self.get('shop9_envios',{'id':'eq.'+env})[0]
  prox=datetime.datetime.fromisoformat(e['proxima_tentativa']); atraso=(prox-datetime.datetime.now(datetime.timezone.utc)).total_seconds()
  self.assertEqual((e['estado'],e['tentativas']),('erro',2)); self.assertTrue(200<atraso<=240,atraso)
  for who in (V1,D): self.assertFalse(self.rpc(who,'shop9_registrar_tentativa',body).ok)

 def test_10_rls(self):
  ids={'vendedor_id':f'in.({V1},{V2})','select':'vendedor_id'}
  vend=lambda who,t: {x['vendedor_id'] for x in self.ok(self.q(who,t,ids))}
  for t in ('carrinhos','liberacoes_desconto'):
   self.assertEqual(vend(V1,t),{V1},t); self.assertEqual(vend(V2,t),{V2},t); self.assertEqual(vend(S,t),{V1,V2},t); self.assertEqual(vend(D,t),{V1,V2},t)
  ro=lambda who: {x['id'] for x in self.ok(self.q(who,'orcamentos',{'origem_rota':'is.true','vendedor_id':f'in.({V1},{V2})','select':'id'}))}
  self.assertEqual(ro(V1),{ST['ORC']}); self.assertEqual(ro(V2),{ST['ORC2']}); self.assertEqual(ro(S),{ST['ORC'],ST['ORC2']})
  ev=lambda who: {x['orcamento_id'] for x in self.ok(self.q(who,'shop9_envios',{'orcamento_id':f'in.({ST["ORC"]},{ST["ORC2"]})','select':'orcamento_id'}))}
  self.assertEqual(ev(V1),{ST['ORC']}); self.assertEqual(ev(V2),{ST['ORC2']}); self.assertEqual(ev(D),{ST['ORC'],ST['ORC2']})
  it=lambda who: len(self.ok(self.q(who,'itens_carrinho',{'carrinho_id':f'in.({ST["K1"]},{ST["KA"]})','select':'id'})))
  self.assertEqual((it(V1),it(V2)),(2,1)); self.assertEqual(it(S),3)
  for t in ('carrinhos','itens_orcamento','shop9_envios','liberacoes_desconto'): self.assertEqual(self.ok(self.q(A,t,{'select':'id'})),[],t)
  for who in (A,S,D): self.assertEqual(self.code(self.abrir(who,'C1')),'42501')

 def test_11_setor(self):
  for t in ('produtos','carrinhos','itens_carrinho','itens_orcamento','shop9_envios','limites_desconto','liberacoes_desconto','motivos_cancelamento_carrinho'):
   self.assertEqual(self.ok(self.q(V3,t,{'select':'id'})),[],t)
  chamadas=[('abrir_carrinho',{'_cliente_id':CL['CX']}),('buscar_produtos',None),('importar_produtos',{'_empresa_id':self.emp,'_arquivo':'x','_linhas':[]}),
   ('limite_desconto',{'_vendedor_id':V3,'_empresa_id':self.emp}),('solicitar_liberacao_desconto',{'_cliente_id':CL['CX'],'_desconto_pct':10,'_motivo':'motivo x'}),
   ('validar_desconto',{'_vendedor_id':V3,'_empresa_id':self.emp,'_cliente_id':CL['CX'],'_carrinho_id':None,'_produto_id':None,'_desconto_pct':1}),
   ('concluir_carrinho',{'_carrinho_id':ST['K1']}),('shop9_pendentes',{'_empresa_id':self.emp}),('definir_limite_desconto',{'_vendedor_id':V3,'_empresa_id':self.emp,'_limite_pct':1})]
  for fn,b in chamadas:
   if b is None: self.assertEqual(self.ok(self.rpc(V3,fn,{'_empresa_id':self.emp,'_termo':'freezer'})),[]); continue
   self.assertEqual(self.code(self.rpc(V3,fn,b)),'42501',fn)

 def test_12_invalidos(self):
  for t in ('carrinhos','itens_carrinho','itens_orcamento','shop9_envios','limites_desconto','liberacoes_desconto'):
   self.assertFalse(requests.post(self.url+'/rest/v1/'+t,headers=self.h[V1],json={'empresa_id':self.emp},timeout=30).ok,t)
   self.assertFalse(requests.patch(self.url+'/rest/v1/'+t,headers=self.h[V1],params={'empresa_id':'eq.'+self.emp},json={'demo':True},timeout=30).ok,t)
   self.assertFalse(requests.delete(self.url+'/rest/v1/'+t,headers=self.h[V1],params={'empresa_id':'eq.'+self.emp},timeout=30).ok,t)
   r=requests.get(self.url+'/rest/v1/'+t,headers=self.pub,params={'select':'id'},timeout=30); self.assertTrue(not r.ok or r.json()==[],t)
  self.assertFalse(requests.post(self.url+'/rest/v1/rpc/abrir_carrinho',headers=self.pub,json={'_cliente_id':CL['C1']},timeout=30).ok)
if __name__=='__main__': unittest.main()
