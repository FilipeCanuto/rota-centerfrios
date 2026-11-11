"""Live integration checks. Fixtures are provisioned separately through data tools.

Run with: python3 -m unittest discover -s tests -p 'test_acesso_convite.py' -v
Requires Cloud credentials in environment; never logs passwords or tokens.
The invited auth user is always deleted after creation. The public fixture must
also be removed through the data tool after inspecting the resulting evidence.
"""
import json
import os
from pathlib import Path
import secrets
import unittest
import requests


class AcessoConvite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.url = os.environ['SUPABASE_URL']
        key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
        cls.headers = {'apikey': key}
        if not key.startswith('sb_'):
            cls.headers['Authorization'] = 'Bearer ' + key
        values = dict(line.split('=', 1) for line in Path('.env').read_text().splitlines()
                      if '=' in line and not line.startswith('#'))
        cls.public_headers = {'apikey': values['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}

    def rejected_signup(self, email, expected_message):
        response = requests.post(self.url + '/auth/v1/signup', headers=self.public_headers,
                                 json={'email': email, 'password': secrets.token_urlsafe(32)}, timeout=30)
        self.assertEqual(response.status_code, 500, response.json().get('code'))
        self.assertEqual(response.json().get('code'), 'P0001')
        self.assertEqual(response.json().get('message'), expected_message)
        users = requests.get(self.url + '/auth/v1/admin/users', headers=self.headers,
                             params={'per_page': 1000}, timeout=30)
        self.assertTrue(users.ok)
        self.assertFalse(any(u['email'].lower() == email.lower() for u in users.json()['users']))
        print(email, ': recusado; resposta pública:', response.json().get('message'))

    def test_1_dominio_nao_permitido(self):
        self.rejected_signup('teste@gmail.com', 'Acesso restrito a e-mails da CENTERFRIOS e da 381 Distribuidora.')

    def test_2_sem_convite(self):
        self.rejected_signup('nao.convidado@centerfrios.com', 'Seu acesso ainda não foi liberado. Peça o convite ao administrador.')

    def test_3_convite_consumido_sem_privilegios_implicitos(self):
        email = 'convidado.teste@grupo381.com.br'
        response = requests.post(self.url + '/auth/v1/admin/users', headers=self.headers,
                                 json={'email': email, 'password': secrets.token_urlsafe(32),
                                       'email_confirm': False}, timeout=30)
        self.assertTrue(response.ok, response.json().get('msg'))
        user_id = response.json()['id']
        try:
            def read(table, params):
                result = requests.get(self.url + '/rest/v1/' + table, headers=self.headers,
                                      params=params, timeout=30)
                self.assertTrue(result.ok, table)
                return result.json()
            rows = read('usuarios', {'id': 'eq.71c0c9b8-d16a-4d55-bf18-f3c097c96024', 'select': 'id,email,auth_user_id'})
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['auth_user_id'], user_id)
            self.assertEqual(rows[0]['email'], 'CONVIDADO.TESTE@GRUPO381.COM.BR')
            roles = read('user_roles', {'user_id': 'eq.' + user_id, 'select': 'role'})
            self.assertEqual(roles, [{'role': 'vendedor'}])
            pending = read('papeis_pre_cadastro', {'usuario_id': 'eq.' + rows[0]['id'], 'select': 'role'})
            self.assertEqual(pending, [])
            memberships = read('usuario_empresas', {'usuario_id': 'eq.' + rows[0]['id'], 'select': 'empresa_id'})
            self.assertEqual(memberships, [{'empresa_id': '028cfc17-c343-4e3d-89b7-aba0125d829d'}])
            print(email, ': associado; somente vendedor; nenhum papel pendente; sem vínculos automáticos.')
        finally:
            deleted = requests.delete(self.url + '/auth/v1/admin/users/' + user_id,
                                      headers=self.headers, timeout=30)
            self.assertTrue(deleted.ok, 'Limpeza do usuário de autenticação')

    def test_4_preserva_contas_existentes(self):
        before_path = Path('/tmp/acesso-convite/admin-before.json')
        if not before_path.exists():
            self.skipTest('Registre o estado das contas antes da execução.')
        before = json.loads(before_path.read_text())
        response = requests.get(self.url + '/auth/v1/admin/users', headers=self.headers,
                                params={'per_page': 1000}, timeout=30)
        self.assertTrue(response.ok)
        current = response.json()['users']
        for email in ['filipecanuto@centerfrios.com', 'adm@centerfrios.com']:
            previous = next(u for u in before if u['email'] == email)
            now = next(u for u in current if u['email'] == email)
            self.assertEqual(now, previous, 'Conta existente deve permanecer integralmente igual')

    def test_configuracoes_preservadas(self):
        response = requests.get(self.url + '/auth/v1/settings', headers=self.public_headers, timeout=30)
        self.assertTrue(response.ok)
        settings = response.json()
        self.assertIs(settings['disable_signup'], False)
        self.assertIs(settings['mailer_autoconfirm'], False)
        self.assertIs(settings['external']['email'], True)
        self.assertIs(settings['external']['google'], True)


if __name__ == '__main__':
    unittest.main()