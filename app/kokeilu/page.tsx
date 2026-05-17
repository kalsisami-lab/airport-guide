import type { Metadata } from 'next';
import KokeiluDashboard from './KokeiluDashboard';

export const metadata: Metadata = {
  title: 'Kokeilu — New Engine',
  description: 'Experimental entitlement engine',
};

export default function KokeiluPage() {
  return <KokeiluDashboard />;
}
