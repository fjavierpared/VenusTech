declare namespace App {
  interface Locals {
    admin?: { id: number; usuario: string };
  }
}

interface Window {
  vtTrack?: (tipo: string, detalle?: string) => void;
  vtVisitante?: string;
}
