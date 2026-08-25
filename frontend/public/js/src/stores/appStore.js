// frontend/src/stores/appStore.js
// Central state store med pub/sub — ersätter alla globala let-variabler
const store = {
  state: {
    token: localStorage.getItem('elstock_token') || null,
    user: JSON.parse(localStorage.getItem('elstock_user') || 'null'),
    activeWarehouse: JSON.parse(localStorage.getItem('elstock_warehouse') || 'null'),
    warehouses: [],
    inventory: [],
    cart: [],
    restockCart: [],
    activeCategories: new Set(),
    activeBrand: null,
    currentScanTarget: null,
    scanStream: null,
    scanInterval: null,
    productSearchTarget: null,
    editingWarehouseId: null,
    currentReceiptId: null,
    currentHistoryType: 'checkout',
    pushSubscription: null,
    geofenceSettings: null,
    geofenceWatchId: null,
    qtyContext: null,
    checkoutSelectedJob: null,
    isOffline: false,
    searchTimeout: null,
    // Extended state för kommande steg
    currentJob: null,
    customerNavStack: [],
    calEvents: [],
    calSelectedDate: null,
    calView: 'month',
    editingEventId: null,
    currentProduct: null,
    currentCategory: null,
    currentCustomer: null,
    permissions: [],
    equipment: [],
    trips: [],
    activeTrip: null,
    categories: [],
    brands: [],
    products: [],
    jobs: [],
    customers: [],
    notifications: [],
    lowStockItems: [],
    settings: {},
    theme: localStorage.getItem('theme') || 'dark',
  },
  listeners: [],

  get(key) { return this.state[key]; },

  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.listeners.forEach(cb => cb(key, value, oldValue));
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  },

  persist(keys = ['token', 'user', 'activeWarehouse', 'theme']) {
    keys.forEach(key => {
      const val = this.state[key];
      if (val === null) localStorage.removeItem(`elstock_${key}`);
      else localStorage.setItem(`elstock_${key}`, JSON.stringify(val));
    });
  }
};

export default store;
