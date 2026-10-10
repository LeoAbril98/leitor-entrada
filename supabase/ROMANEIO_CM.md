# Campinas e pedidos de carga

## Tabelas

- `romaneio_estoque_cm`: codigo, descricao, quantidade, arquivo_origem e atualizado_em.
- `pedidos_romaneio`: pedidos enviados de SC e CM, com itens e caminhos do PDF/Excel.
- `romaneio_pedido_rascunhos`: um rascunho por aparelho/navegador e origem.

O estoque CM e independente de SC, PR e Pendencias. Os codigos devem estar
em maiusculas e sem espacos nas extremidades. A quantidade e um inteiro >= 0.
Importacoes precisam atualizar os saldos e zerar codigos ausentes do novo estoque.

## Recuperacao

Cada alteracao e salva primeiro no navegador e depois no Supabase.
Uma versao crescente impede que uma resposta atrasada substitua dados recentes.
Ao enviar ou remover todos os itens, uma versao vazia fica na nuvem para impedir
que um rascunho antigo reapareca.

Ao reabrir o pedido no mesmo navegador, o app compara as versoes local e remota.
Sem rede, mantem a copia local e mostra a sincronizacao pendente, com nova
tentativa ao voltar a conexao ou pelo botao de sincronizacao.

A identificacao privada do navegador e mantida em `mkr_romaneio_draft_device_v1`.
Fechar o app nao remove essa identificacao. Limpar todos os dados do navegador
ou mudar de navegador/aparelho nao recupera automaticamente o mesmo rascunho.
Rascunhos nao podem ser listados publicamente: as funcoes exigem essa chave.

## Compatibilidade

Os pedidos SC antigos em Storage continuam sendo listados. Pedidos novos
ficam tambem em `pedidos_romaneio`. O administrador pode baixar os arquivos
e excluir o registro e os arquivos juntos.

O projeto atual usa `fotos/sync/romaneios_data.json` para as cargas existentes,
pois a tabela `romaneios` ainda nao existe. Este espelho foi preservado.
Nao criar uma tabela vazia de cargas sem migrar o espelho existente.

## Chaves e permissoes

O site usa apenas a chave publica anon/publishable. A configuracao do Vite
bloqueia uma chave service_role ou sb_secret em variaveis VITE_SUPABASE.
Chaves administrativas pertencem somente ao servidor/robo, nunca ao site.
O ambiente do provedor de hospedagem tambem deve usar a chave publica correta.
Uma chave administrativa ja exposta em versoes anteriores deve ser rotacionada
pelo administrador no Supabase, atualizando depois os robos que a utilizem.

As regras de Storage do romaneio sao limitadas a pedidos-rodas-sc/,
pedidos-rodas-cm/ e aos dois arquivos de sincronizacao de romaneios.
Nao liberam escrita publica nas demais pastas de fotos. Fluxos administrativos
fora do romaneio devem utilizar autenticacao/backend com permissoes proprias.

## Verificacao

`scripts/test-sc-load-order.cjs` aceita TEST_ORDER_ORIGIN=SC ou CM e usa
dados simulados para testar carga, estoque, rascunho, rede indisponivel,
arquivos, administrador, exclusao e upload de Campinas em desktop/mobile.
`scripts/check-romaneio-schema.cjs` verifica a conexao real sem alterar dados.
`supabase/test_romaneio_drafts.sql` testa as funcoes em uma transacao desfeita.
