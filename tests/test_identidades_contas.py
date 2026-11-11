"""Read-only authenticated regression for the two existing corporate accounts.

Uses the injected Willames session and the requester's minted Filipe session.
Never provisions users, changes passwords, or mutates production data.
"""
import json
import os
import unittest
from pathlib import Path

import requests


class Identidades(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        env = dict(line.split('=', 1) for line in Path('.env').read_text().splitlines()
                   if '=' in line and not line.startswith('#'))
        cls.url = env['VITE_SUPABASE_URL'].strip('"')
        cls.key = env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')
        cls.sessions = {
            'filipe': json.loads(Path.home().joinpath('.cache/lovable-auth/session.json').read_text())['session'],
            'willames': json.loads(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON']),
        }

    def rows(self, account, table, params=None):
        r = requests.get(self.url + '/rest/v1/' + table, params=params,
                         headers={'apikey': self.key, 'Authorization': 'Bearer ' + self.sessions[account]['access_token']},
                         timeout=30)
        self.assertEqual(r.status_code, 200, 'Authenticated read failed for ' + table)
        return r.json()

    def test_filipe_identity_and_global_roles(self):
        uid = 'f7c7763c-dbd7-46f2-bcb3-5f15be66eb74'
        self.assertEqual(self.sessions['filipe']['user']['id'], uid)
        u = self.rows('filipe', 'usuarios', {'id': 'eq.830d3560-06b0-4506-b40c-6ba424e34ce0'})[0]
        self.assertEqual((u['nome'], u['apelido_copiloto'], u['auth_user_id'], u['email'], u['demo'], u['equipe_id']),
                         ('Filipe Canuto', 'Filipe', uid, 'filipecanuto@centerfrios.com', False, None))
        roles = self.rows('filipe', 'user_roles', {'user_id': 'eq.' + uid})
        self.assertEqual(sorted((r['role'], r['empresa_id']) for r in roles), [('administrador', None), ('diretoria', None)])

    def test_filipe_sees_60_but_owns_zero(self):
        rows = self.rows('filipe', 'clientes')
        self.assertEqual(len(rows), 60)
        self.assertTrue(all(r['demo'] for r in rows))
        self.assertEqual(sum(r['vendedor_id'] == '830d3560-06b0-4506-b40c-6ba424e34ce0' for r in rows), 0)

    def test_willames_identity_and_global_role(self):
        uid = '900e686d-4ba6-4640-9b84-e457c45e2e4d'
        self.assertEqual(self.sessions['willames']['user']['id'], uid)
        u = self.rows('willames', 'usuarios', {'id': 'eq.00b31584-f79e-4e93-9a14-96f308eed4f4'})[0]
        self.assertEqual((u['nome'], u['apelido_copiloto'], u['auth_user_id'], u['email'], u['demo'], u['equipe_id']),
                         ('Willames Costa', 'Willames', uid, 'adm@centerfrios.com', False, None))
        roles = self.rows('willames', 'user_roles', {'user_id': 'eq.' + uid})
        self.assertEqual([(r['role'], r['empresa_id']) for r in roles], [('administrador', None)])

    def test_willames_has_no_commercial_visibility(self):
        for table in ['clientes', 'vendas', 'metas']:
            with self.subTest(table=table):
                self.assertEqual(self.rows('willames', table), [])

    def test_demo_identities_are_separate_without_login(self):
        demo = self.rows('filipe', 'usuarios', {'demo': 'eq.true'})
        self.assertEqual({u['nome'] for u in demo}, {'Humberto Demo', 'Clara Demo', 'Supervisor Demo'})
        self.assertTrue(all(u['auth_user_id'] is None for u in demo))
        clients = self.rows('filipe', 'clientes')
        for name in ['Humberto Demo', 'Clara Demo']:
            uid = next(u['id'] for u in demo if u['nome'] == name)
            self.assertEqual(sum(c['vendedor_id'] == uid for c in clients), 30)

    def test_company_memberships_unchanged(self):
        expected = {'49ddeee5-cbe2-4bf0-a53b-f5f7ef3e31b1', '028cfc17-c343-4e3d-89b7-aba0125d829d'}
        for uid in ['830d3560-06b0-4506-b40c-6ba424e34ce0', '00b31584-f79e-4e93-9a14-96f308eed4f4']:
            links = self.rows('filipe', 'usuario_empresas', {'usuario_id': 'eq.' + uid})
            self.assertEqual({r['empresa_id'] for r in links}, expected)
            self.assertTrue(all(r['created_at'].startswith('2026-11-10T21:00:41.532278') for r in links))

    def test_permission_changes_are_audited(self):
        rows = self.rows('filipe', 'registro_auditoria', {'acao': 'eq.alteracao_permissao', 'created_at': 'gte.2026-11-11T03:46:00Z'})
        changes = []
        for r in rows:
            d = r['detalhes']
            old, new = d.get('antigo'), d.get('novo')
            v = new or old
            if v:
                changes.append((d['operacao'], v['user_id'], v['role']))
        self.assertEqual(set(changes), {
            ('DELETE', 'f7c7763c-dbd7-46f2-bcb3-5f15be66eb74', 'vendedor'),
            ('DELETE', '900e686d-4ba6-4640-9b84-e457c45e2e4d', 'vendedor'),
            ('INSERT', 'f7c7763c-dbd7-46f2-bcb3-5f15be66eb74', 'diretoria'),
            ('INSERT', '900e686d-4ba6-4640-9b84-e457c45e2e4d', 'administrador'),
        })


if __name__ == '__main__':
    unittest.main()