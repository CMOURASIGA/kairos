# Governanca de Repositorio (US-001)

## Branches

- `main`: branch protegida para producao.
- `dev`: branch de integracao continua.
- `feat/<us>-<descricao-curta>`: implementacoes de features.
- `fix/<descricao-curta>`: correcoes de defeito.

## Convencao de commit

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
- `chore: ...`
- `test: ...`

## Pull Request

- Base padrao: `dev`.
- Obrigatorio descrever impacto funcional e tecnico.
- Relacionar US no titulo ou descricao (ex.: `US-008`).
- Incluir evidencias de validacao (`typecheck`, `lint`, testes relevantes).

## Merge para main

- Apenas via PR aprovado.
- Exigir pipeline verde.
- Evitar merge direto manual em `main`.

