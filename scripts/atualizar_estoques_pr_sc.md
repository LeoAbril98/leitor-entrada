# Atualizacao PR e SC

Versao adaptada do robo existente. Executa PR e depois SC em sessoes separadas.
Nao altera Pendencias. PR continua em inventario_itens; SC vai exclusivamente
para romaneio_estoque_sc, com codigo, descricao, quantidade e arquivo_origem.

Use no mesmo ambiente do robo original, com python-dotenv, requests e Playwright.
Mantenha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env do robo, nunca no
frontend nem em arquivos publicados. O .env deve estar junto ao arquivo Python.

Configure tambem:

```dotenv
MK_EMPRESA="TREINAMENTO - MKRODAS"
MK_USUARIO=LEO
MK_SENHA=<senha atual do PR>
MK_SC_EMPRESA="TREINAMENTO - MOLERI"
MK_SC_USUARIO=LEO
MK_SC_SENHA=<senha informada para SC>
```

As senhas nao ficam gravadas no codigo. Os demais ajustes do .env original
continuam funcionando, incluindo MK_LOGIN e MK_DOWNLOAD_DIR.

```sh
python scripts/atualizar_estoques_pr_sc.py
python scripts/atualizar_estoques_pr_sc.py --estado sc
python scripts/atualizar_estoques_pr_sc.py --estado pr
```

Se colocar o arquivo junto ao robo original, retire scripts/ dos comandos.
Os downloads sao inventario_pr.xml e inventario_sc.xml.
SC usa os mesmos filtros de grupo 050 a 051 e situacao A do PR.

Um XML vazio ou com quantidade SC negativa e rejeitado antes do envio.
Codigos SC repetidos sao somados e normalizados. Apos enviar os novos saldos,
os codigos antigos ausentes do XML recebem zero.

O envio e feito em lotes, nao em uma transacao unica. Uma falha pode deixar
parte dos saldos atualizada; execute novamente apenas o estado com falha.
PR mantem o comportamento original de limpar itens antes de reinserir.
Se PR falhar, o robo ainda tenta SC e termina informando a falha parcial.

O login e download SC ainda precisam ser conferidos em uma execucao real.
