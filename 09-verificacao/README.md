# Verificação

node 09-verificacao/testar-controles.cjs
python3 09-verificacao/testar-secoes.py
python3 09-verificacao/validar-kit.py

O teste de seções verifica a ordem texto/foto, foto/texto, texto/foto, a ausência dos seletores de painéis escuros e os hashes do hero preservado. O teste JS usa DOM mínimo e não testa renderização de navegador. Python requer Pillow para validar os PNG.

Antes de publicar, revisar visualmente Chrome, Safari e Firefox nas larguras 390, 768 e 1440px, além de zoom, teclado e reduced motion. Contatos mantidos da versão anterior.
