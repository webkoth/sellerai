export const QUEUE_NAMES = {
  // Inbound sync (from master marketplace)
  SYNC_INBOUND_PRODUCTS: 'sync-inbound-products',
  SYNC_INBOUND_PRICES: 'sync-inbound-prices',
  SYNC_INBOUND_STOCKS: 'sync-inbound-stocks',

  // Outbound sync (to slave marketplaces)
  SYNC_OUTBOUND_PRODUCTS: 'sync-outbound-products',
  SYNC_OUTBOUND_PRICES: 'sync-outbound-prices',
  SYNC_OUTBOUND_STOCKS: 'sync-outbound-stocks',

  // Bidirectional stock sync (order on any MP → update on all)
  ORDERS_STOCK_UPDATE: 'orders-stock-update',

  // Rate-limited marketplace queues
  MP_WILDBERRIES_CONTENT: 'mp-wb-content',
  MP_WILDBERRIES_MARKETPLACE: 'mp-wb-marketplace',
  MP_WILDBERRIES_STOCKS: 'mp-wb-stocks',
  MP_OZON: 'mp-ozon',
  MP_YANDEX: 'mp-yandex',

  // Order polling
  ORDER_POLL: 'orders-poll',

  // Scheduled tasks
  SCHEDULED_SYNC: 'scheduled-sync',
  STOCK_RECONCILIATION: 'scheduled-stock-reconciliation',

  // Notifications
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
