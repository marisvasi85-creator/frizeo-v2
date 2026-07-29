import { permanentRedirect } from "next/navigation";

/** Legacy listing — canonical public directory is /frizerii. */
export default function BarbersPage() {
  permanentRedirect("/frizerii");
}
