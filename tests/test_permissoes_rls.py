"""Live authenticated RLS checks. Provision and remove public fixtures with data tools.
Run: python3 -m unittest discover -s tests -p 'test_permissoes_rls.py' -v
Never prints credentials or tokens; only temporary records are mutated.
"""
import json
import os
from pathlib import Path
import secrets
import unittest
import requests

CF = '49ddeee5-cbe2-4bf0-a53b-f5f7ef3e31b1'
D381 = '028cfc17-c343-4e3d-89b7-aba0125d829d'
BASE = '11111111-1111-4111-8111-111111111'
def fixture(suffix):
    return BASE + suffix

class PermissoesRLS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.url = os.environ['SUPABASE_URL']
        key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
        cls.service = {'apikey': key}
        if not key.startswith('sb_'):
            cls.service['Authorization'] = 'Bearer ' + key
        values = dict(line.split('=', 1) for line in Path('.env').read_text().splitlines()
                      if '=' in line and not line.startswith('#'))
        cls.public = {'apikey': values['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}
        cls.accounts = {}
        cls.report = []
        cls.addClassCleanup(cls.cleanup)
        for role, suffix in [('vendedor','101'),('supervisor','102'),('diretoria','103'),('administrador','104')]:
            email = 'rls.' + role + '.teste@centerfrios.com'
            password = secrets.token_urlsafe(32)
            r = requests.post(cls.url+'/auth/v1/admin/users', headers=cls.service,
                              json={'email':email,'password':password,'email_confirm':True},timeout=30)
            if not r.ok:
                raise RuntimeError('Falha ao criar conta temporária: ' + str(r.status_code))
            cls.accounts[role] = {'id':r.json()['id'],'usuario':fixture(suffix)}
            r = requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.public,
                              json={'email':email,'password':password},timeout=30)
            if not r.ok:
                raise RuntimeError('Falha no login temporário: ' + str(r.status_code))
            cls.accounts[role]['headers'] = {**cls.public,'Authorization':'Bearer '+r.json()['access_token'],'Prefer':'return=representation,count=exact'}

    @classmethod
    def cleanup(cls):
        failures=[]
        for account in cls.accounts.values():
            r=requests.delete(cls.url+'/auth/v1/admin/users/'+account['id'],headers=cls.service,timeout=30)
            if not r.ok: failures.append(r.status_code)
        Path('/tmp/rls/results.json').write_text(json.dumps(cls.report,ensure_ascii=False,indent=2))
        if failures: raise RuntimeError('Falha na limpeza das contas temporárias')
        print('Contas de autenticação temporárias apagadas.')

    def api(self,role,method,table,body=None,params=None):
        return requests.request(method,self.url+'/rest/v1/'+table,headers=self.accounts[role]['headers'],json=body,params=params,timeout=30)
    def ok(self,r):
        self.assertTrue(r.ok, str(r.status_code)+': '+r.text[:300]); return r.json()
    def denied(self,r):
        self.assertEqual(r.status_code,403,r.text[:300]); self.assertEqual(r.json().get('code'),'42501')
    def note(self,role,check,result):
        self.report.append({'perfil':role,'verificacao':check,'resultado':result})
        print(role,check,result)

    def test_01_vendedor_le_so_proprios(self):
        rows=self.ok(self.api('vendedor','GET','clientes',params={'select':'id,vendedor_id'}))
        self.assertEqual(len(rows),2)
        self.assertTrue(all(r['vendedor_id']==fixture('101') for r in rows))
        self.note('Vendedor','Clientes visíveis',len(rows))
    def test_02_vendedor_nao_altera_metas(self):
        rows=self.ok(self.api('vendedor','PATCH','metas',{'meta_vendas':1}, {'id':'eq.'+fixture('130')}))
        self.assertEqual(rows,[])
        self.note('Vendedor','Alteração de metas','0 linhas')
    def test_03_vendedor_nao_insere_vendas(self):
        self.denied(self.api('vendedor','POST','vendas',{'empresa_id':CF,'vendedor_id':fixture('101'),'cliente_id':fixture('121'),'data_faturamento':'2026-11-11','valor':1}))
        self.note('Vendedor','Inserir vendas','Recusado 42501')
    def test_04_vendedor_nao_altera_equipe(self):
        self.denied(self.api('vendedor','PATCH','usuarios',{'equipe_id':None},{'auth_user_id':'eq.'+self.accounts['vendedor']['id']}))
        self.note('Vendedor','Alterar equipe_id','Recusado 42501')
    def test_05_vendedor_altera_tema(self):
        rows=self.ok(self.api('vendedor','PATCH','usuarios',{'tema':'escuro'},{'auth_user_id':'eq.'+self.accounts['vendedor']['id']}))
        self.assertEqual(len(rows),1); self.assertEqual(rows[0]['tema'],'escuro')
        self.note('Vendedor','Alterar tema','1 linha; escuro')
    def test_06_supervisor_ve_equipe(self):
        rows=self.ok(self.api('supervisor','GET','clientes',params={'select':'id,vendedor_id'}))
        self.assertEqual(len(rows),2); self.assertTrue(all(r['vendedor_id']==fixture('101') for r in rows))
        self.note('Supervisor','Clientes da equipe / outras equipes','2 / 0')
    def test_07_supervisor_nao_remaneja(self):
        rows=self.ok(self.api('supervisor','PATCH','clientes',{'vendedor_id':fixture('102')},{'id':'eq.'+fixture('121')}))
        self.assertEqual(rows,[])
        self.note('Supervisor','Remanejar clientes','0 linhas; bloqueado por RLS')
    def test_08_diretoria_ve_todos(self):
        rows=self.ok(self.api('diretoria','GET','clientes',params={'select':'id,empresa_id'}))
        expected=requests.get(self.url+'/rest/v1/clientes',headers=self.service,params={'select':'id'},timeout=30).json()
        self.assertEqual(len(rows),len(expected)); self.assertEqual({r['empresa_id'] for r in rows},{CF,D381})
        self.note('Diretoria','Todos os clientes nas duas empresas',len(rows))
    def test_09_diretoria_altera_meta(self):
        rows=self.ok(self.api('diretoria','PATCH','metas',{'meta_vendas':54321},{'id':'eq.'+fixture('130')}))
        self.assertEqual(len(rows),1); self.assertEqual(rows[0]['meta_vendas'],54321)
        self.note('Diretoria','Alterar metas','1 linha')
    def test_10_diretoria_altera_regra(self):
        rows=self.ok(self.api('diretoria','PATCH','configuracoes_regras',{'valor':8},{'id':'eq.'+fixture('160')}))
        self.assertEqual(len(rows),1); self.assertEqual(rows[0]['valor'],8)
        self.note('Diretoria','Alterar regras','1 linha')
    def test_11_admin_sem_comercial(self):
        for table in ['clientes','vendas','metas','registro_auditoria']:
            rows=self.ok(self.api('administrador','GET',table,params={'select':'id'}))
            self.assertEqual(rows,[])
            self.note('Administrador','Leitura '+table,'0 linhas')
    def test_12_admin_cria_usuario(self):
        rows=self.ok(self.api('administrador','POST','usuarios',{'id':fixture('170'),'nome':'Teste RLS convite criado','email':'rls.convite.teste@centerfrios.com'}))
        self.assertEqual(rows[0]['id'],fixture('170')); self.note('Administrador','Criar usuarios','Permitido')
    def test_13_admin_cria_vinculo(self):
        rows=self.ok(self.api('administrador','POST','usuario_empresas',{'usuario_id':fixture('170'),'empresa_id':CF}))
        self.assertEqual(rows[0]['empresa_id'],CF); self.note('Administrador','Criar usuario_empresas','Permitido')
    def test_14_admin_cria_papel(self):
        rows=self.ok(self.api('administrador','POST','user_roles',{'user_id':self.accounts['vendedor']['id'],'role':'vendedor','empresa_id':D381}))
        self.assertEqual(rows[0]['empresa_id'],D381); self.note('Administrador','Criar user_roles','Permitido')
    def test_15_admin_cria_link(self):
        headers={**self.accounts['administrador']['headers'],'Prefer':'return=minimal'}
        response=requests.post(self.url+'/rest/v1/links',headers=headers,json={'id':fixture('180'),'empresa_id':CF,'titulo':'Teste RLS link','url':'https://example.com'},timeout=30)
        self.assertEqual(response.status_code,201,response.text[:300])
        # No membership: insertion is allowed but reading its representation is not.
        response=requests.get(self.url+'/rest/v1/links',headers=self.service,params={'id':'eq.'+fixture('180'),'select':'id'},timeout=30)
        self.assertEqual(response.json(),[{'id':fixture('180')}]); self.note('Administrador','Criar links','Permitido; sem leitura fora dos vínculos')
    def test_16_admin_nao_altera_regra(self):
        rows=self.ok(self.api('administrador','PATCH','configuracoes_regras',{'valor':1},{'id':'eq.'+fixture('160')}))
        self.assertEqual(rows,[]); self.note('Administrador','Alterar regras','0 linhas')
    def test_17_colunas_orcamento(self):
        rows=self.ok(self.api('vendedor','PATCH','orcamentos',{'ultimo_followup':'2026-11-11'},{'id':'eq.'+fixture('140')}))
        self.assertEqual(rows[0]['ultimo_followup'],'2026-11-11')
        self.denied(self.api('vendedor','PATCH','orcamentos',{'valor':2},{'id':'eq.'+fixture('140')}))
    def test_18_colunas_alertas(self):
        rows=self.ok(self.api('vendedor','PATCH','alertas',{'lido':True},{'id':'eq.'+fixture('150')}))
        self.assertIs(rows[0]['lido'],True)
        self.denied(self.api('vendedor','PATCH','alertas',{'mensagem':'Não permitido'},{'id':'eq.'+fixture('150')}))
    def test_19_funcao_admin(self):
        self.denied(self.api('vendedor','POST','rpc/admin_atualizar_usuario',{'_usuario_id':fixture('101'),'_dados':{'nome':'Não permitido'}}))
        rows=self.ok(self.api('administrador','POST','rpc/admin_atualizar_usuario',{'_usuario_id':fixture('170'),'_dados':{'nome':'Teste RLS atualizado','equipe_id':None}}))
        row=rows[0] if isinstance(rows,list) else rows
        self.assertEqual(row['nome'],'Teste RLS atualizado')
    def test_20_papel_escopo_empresa(self):
        rows=self.ok(self.api('administrador','DELETE','user_roles',params={'user_id':'eq.'+self.accounts['supervisor']['id'],'role':'eq.supervisor','empresa_id':'is.null'}))
        self.assertEqual(len(rows),1)
        for company,expected in [(CF,False),(D381,True)]:
            value=self.ok(self.api('supervisor','POST','rpc/has_role',{'_user_id':self.accounts['supervisor']['id'],'_role':'supervisor','_empresa_id':company}))
            self.assertIs(value,expected)
        old=self.ok(self.api('supervisor','POST','rpc/has_role',{'_user_id':self.accounts['supervisor']['id'],'_role':'supervisor'}))
        self.assertIs(old,False)
        self.note('Papel por empresa','Supervisor CENTERFRIOS / 381','false / true; legado false')
    def test_21_convite_consumido(self):
        for role in self.accounts:
            pending=self.ok(self.api('administrador','GET','papeis_pre_cadastro',params={'usuario_id':'eq.'+self.accounts[role]['usuario']}))
            self.assertEqual(pending,[])
            rows=self.ok(self.api('administrador','GET','usuarios',params={'id':'eq.'+self.accounts[role]['usuario'],'select':'auth_user_id'}))
            self.assertEqual(rows[0]['auth_user_id'],self.accounts[role]['id'])

if __name__=='__main__':
    unittest.main()
