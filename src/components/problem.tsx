export function Problem({ message }: { message: string }) {
  return <div className="notice notice-error" role="alert"><strong>No pudimos completar esta acción</strong><p>{message}</p></div>;
}
