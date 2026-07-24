-- Cria um usuário e jogador de teste (#2PP) para validar o sync ponta a ponta.
INSERT INTO "User" (id, email, "emailVerified", name, "createdAt", "updatedAt")
VALUES ('synctest-user', 'synctest@clashpilot.test', true, 'Sync Test', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Player" (id, "userId", tag, name, verified, "isPrimary", "syncEnabled", "syncPriority", "createdAt")
VALUES ('synctest-player', 'synctest-user', '#2PP', 'Morgil', true, true, true, 10, now())
ON CONFLICT (id) DO NOTHING;
