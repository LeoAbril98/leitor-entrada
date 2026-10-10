# Envio dos pedidos pelo Gmail

Remetente: leoabril98@gmail.com. Os destinatarios SC e CM sao configurados
separadamente em Gestao de Romaneios > Pedidos de Rodas > Destinatarios.
As configuracoes ficam no Supabase e nao sao acessiveis pela chave publica.

## Ativacao

1. Aplicar `supabase/romaneio_email.sql` no projeto Supabase.
2. Na conta Google do remetente, com verificacao em duas etapas ativada,
   criar uma senha de app em https://myaccount.google.com/apppasswords.
   O titular da conta deve criar e inserir a senha pessoalmente.
3. Na hospedagem Vercel, cadastrar as variaveis de servidor:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_APP_PASSWORD` e
   `ROMANEIO_EMAIL_ADMIN_PASSWORD`. A ultima e uma senha forte exclusiva
   para configurar os destinatarios. A senha administrativa atual do site,
   verificada apenas no navegador, nao protege configuracoes de e-mail.
   Nunca usar prefixo `VITE_` nesses segredos, nem coloca-los no Git.
4. Publicar o site com a funcao `api/romaneio-email.js`. A funcao usa
   Gmail SMTP com TLS na porta 465; a senha de app fica somente no servidor.
5. Abrir Destinatarios, informar a senha de configuracao, adicionar os
   enderecos, ativar o envio e salvar para cada origem.
6. Fazer um pedido de teste para destinatarios autorizados e conferir os
   dois anexos no Gmail. Aceitacao pelo Gmail nao garante chegada na caixa
   de entrada: confira tambem spam e enderecos recusados.

## Comportamento

O pedido e salvo na gestao antes do e-mail. Uma falha de e-mail nao apaga
o pedido nem exige criar outro: o administrador pode tentar novamente.
O servidor busca os destinatarios e os arquivos armazenados; o navegador
nao escolhe anexos, remetente ou destinatarios durante o envio.

Cada pedido possui uma reserva persistente no banco. Pedidos enviados ou
em envio nao sao enviados novamente. SMTP nao oferece idempotencia:
se houver queda de conexao depois de iniciar o envio, o status fica
"Conferir envio no Gmail" e a repeticao fica bloqueada para evitar duplicatas.
Se o processo morrer, a reserva vira incerta ao consultar novamente apos
dois minutos. Nenhuma rotina repete automaticamente um envio incerto.

O fluxo atual dos operadores nao possui login individual. Por isso o
endpoint de envio aceita somente pedidos existentes, usa destinatarios
predefinidos e limita o total a dez tentativas diarias para SC e CM juntos.
Nao e um endpoint de envio livre. A edicao de destinatarios exige senha
privada verificada no servidor. Pode haver tentativas indesejadas de
consumir a cota se um terceiro conseguir criar pedidos no modelo publico
atual; um login de operador seria necessario para impedir esse abuso.

Em desenvolvimento, a mesma API funciona pelo Vite quando as variaveis
estao em `.env.local`. Sem segredos ela informa que o envio nao foi ativado.
Nao chamar envios reais durante testes automatizados: usar transporte
simulado, como em `scripts/test-romaneio-email.mjs`.
