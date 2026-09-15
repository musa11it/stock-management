import { PageHeader } from '@/components/common/PageHeader';
import { MenuBrowser } from '@/components/ordering/MenuBrowser';

export default function OrderPage() {
  return (
    <div>
      <PageHeader title="Order food" description="Add items from the menu, then place your order." />
      <MenuBrowser />
    </div>
  );
}
