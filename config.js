// Dados do projeto Supabase (Project Settings › API).
// A chave "anon" é pública por design — quem protege os dados são as
// regras RLS do schema.sql (só os e-mails da tabela "membros" acessam).
// Se deixar vazio, o app pede esses dados na primeira abertura.
window.ENXOVAL_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};
