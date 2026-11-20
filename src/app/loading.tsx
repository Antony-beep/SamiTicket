import { HaloProgress } from '@/components/ui/halo-progress';

export default function Loading() {
  return <div className="container route-loading"><HaloProgress value={null} label="Cargando SamiTicket…" /></div>;
}
