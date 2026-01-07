import { ThemedText } from '@/components/themed-text';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  CFPaymentGatewayService,
} from 'react-native-cashfree-pg-sdk';

import {
  CFDropCheckoutPayment,
  CFEnvironment,
  CFSession,
  CFThemeBuilder,
} from 'cashfree-pg-api-contract';

const MEDUSA_URL = 'http://172.29.118.64:9000'; 
const HEARTITOUT_SLOTS_URL = 'https://knightsbridge.heartitout.in/webhook/api/hio/services/get_all_slots';
const PUBLISHABLE_API_KEY = 'pk_e3daf218eb487c40b1dc5217e7cb56ec05b6b1f9a8733e599190a7fe7efa3132';
const SERVICE_VARIANT_ID = "variant_01KEBG7JCDWA5WRE4YD7XPWK11";

export default function App() {
  const [view, setView] = useState<'SLOTS' | 'CHECKOUT' | 'ORDERS'>('SLOTS');
  const [selectedSlot, setSelectedSlot] = useState<{ date: string, time: string } | null>(null);
  const [user, setUser] = useState<any>(null);
  // 🟢 Track Cart ID to complete order after payment
  const [currentCartId, setCurrentCartId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
    
    CFPaymentGatewayService.setCallback({
      onVerify: async (orderID: string) => {
        console.log("✅ Payment Success. OrderID:", orderID);
        
        // 🟢 TRIGGER ORDER CREATION IN MEDUSA
        if (currentCartId) {
            await handleCompleteOrder(currentCartId);
        } else {
            Alert.alert("Success", "Payment verified, but Cart ID was missing.");
            setView('ORDERS');
        }
      },
      onError: (error: any, orderID: string) => {
        console.log("❌ Payment Failed:", error);
        Alert.alert("Failed", "Payment could not be completed.");
      }
    });

    return () => CFPaymentGatewayService.removeCallback();
  }, [currentCartId]); // 🟢 Added dependency

  const fetchUserProfile = async () => {
    try {
      const res = await axios.get(`${MEDUSA_URL}/store/customers/me`, { 
        headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY }
      });
      if (res.data.customer) setUser(res.data.customer);
    } catch (error) { console.log("Guest mode"); }
  };

  // 🟢 NEW: Function to finalize order in Medusa
  const handleCompleteOrder = async (cartId: string) => {
    try {
        console.log("🔄 Finalizing Medusa Order for Cart:", cartId);
        const config = { headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY } };
        
        // This call moves the cart to 'Orders' in Medusa
        const res = await axios.post(`${MEDUSA_URL}/store/carts/${cartId}/complete`, {}, config);
        
        if (res.data.type === 'order') {
            Alert.alert("Order Placed!", `Your Order #${res.data.data.display_id} has been created.`);
            setCurrentCartId(null); // Clear cart ID
            setView('ORDERS'); // Go to orders view
        } else {
            // Sometimes it returns pending
            Alert.alert("Processing", "Payment received. Order creation is pending.");
            setView('ORDERS');
        }
    } catch (error: any) {
        console.error("Order Completion Error:", error.response?.data || error.message);
        Alert.alert("Error", "Payment success, but order creation failed. Please check My Orders.");
        setView('ORDERS');
    }
  };

  const handleProceedToCheckout = (slot: { date: string, time: string }) => {
    setSelectedSlot(slot);
    setView('CHECKOUT');
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      {view === 'SLOTS' ? (
        <SlotSelectionView 
          onProceed={handleProceedToCheckout}
          onViewOrders={() => setView('ORDERS')}
        />
      ) : view === 'CHECKOUT' ? (
        <CheckoutModal 
          selectedSlot={selectedSlot} 
          user={user} 
          onBack={() => setView('SLOTS')}
          // 🟢 Pass callback to capture Cart ID
          onCartCreated={(id: string) => setCurrentCartId(id)}
        />
      ) : (
        <OrdersView 
          user={user}
          onBack={() => setView('SLOTS')}
        />
      )}
    </SafeAreaView>
  );
}

const SlotSelectionView = ({ onProceed, onViewOrders }: any) => {
  const [loading, setLoading] = useState(false);
  const [groupedSlots, setGroupedSlots] = useState<any>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => { fetchSlots(); }, []);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const response = await axios.post(HEARTITOUT_SLOTS_URL, {
        "therapist_id": "10", "loc_id": "2", "service_id": "13", "get_more": 0
      });
      const data = response.data;
      const slotsMap: any = {};
      if (data.Slots && Array.isArray(data.Slots)) {
        data.Slots.forEach((str: string) => {
          const [d, t] = str.split(' ');
          if (!slotsMap[d]) slotsMap[d] = [];
          slotsMap[d].push(t.substring(0, 5)); 
        });
      }
      setGroupedSlots(slotsMap);
      setAvailableDates(data.dates || Object.keys(slotsMap));
      if (data.dates?.length > 0) setSelectedDate(data.dates[0]);
    } catch (e) { Alert.alert('Error', 'Failed to load slots'); } 
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Book Appointment</ThemedText>
        <TouchableOpacity onPress={onViewOrders} style={styles.ordersButton}>
          <ThemedText style={styles.ordersButtonText}>My Orders</ThemedText>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator size="large" color="#000" style={{marginTop:50}}/> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.section}>
            <ThemedText style={styles.label}>Select Date</ThemedText>
            <FlatList horizontal data={availableDates} keyExtractor={i=>i} showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.dateChip, selectedDate===item && styles.bgBlack]} onPress={()=>{setSelectedDate(item); setSelectedTime(null);}}>
                  <ThemedText style={selectedDate===item ? styles.textWhite : styles.textBlack}>
                    {new Date(item).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                  </ThemedText>
                </TouchableOpacity>
              )}
            />
          </View>
          <View style={styles.section}>
             <ThemedText style={styles.label}>Select Time</ThemedText>
             <View style={styles.grid}>
               {selectedDate && groupedSlots[selectedDate]?.map((time: string) => (
                 <TouchableOpacity key={time} style={[styles.timeChip, selectedTime===time && styles.bgBlack]} onPress={()=>setSelectedTime(time)}>
                   <ThemedText style={selectedTime===time ? styles.textWhite : styles.textBlack}>{time}</ThemedText>
                 </TouchableOpacity>
               ))}
             </View>
          </View>
        </ScrollView>
      )}
      {selectedDate && selectedTime && (
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fabButton} onPress={() => onProceed({ date: selectedDate, time: selectedTime })}>
            <ThemedText style={styles.fabText}>Proceed to Checkout</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const CheckoutModal = ({ selectedSlot, user, onBack, onCartCreated }: any) => {
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [detectedProviderId, setDetectedProviderId] = useState<string | null>(null);
  
  const [email, setEmail] = useState(user?.email || '');
  const [couponCode, setCouponCode] = useState('');
  const [form, setForm] = useState({ 
      first_name: user?.first_name || '', 
      last_name: user?.last_name || '', 
      phone: user?.phone || '' 
  });

  useEffect(() => { initializeCart(); }, []);

  const initializeCart = async () => {
    setLoading(true);
    try {
      const config = { headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY } };
      
      let inrRegionId = null;
      try {
        const regionsRes = await axios.get(`${MEDUSA_URL}/store/regions`, {
             ...config,
             params: { fields: '+payment_providers.id' } 
        });
        const indiaRegion = regionsRes.data.regions.find((r:any) => r.currency_code === 'inr');
        if (indiaRegion) inrRegionId = indiaRegion.id;
      } catch (e) { console.log("Region fetch error", e); }

      const cartPayload: any = {};
      if (inrRegionId) cartPayload.region_id = inrRegionId;
      if (user?.id) {
          cartPayload.customer_id = user.id;
          cartPayload.email = user.email; 
      }

      const res = await axios.post(`${MEDUSA_URL}/store/carts`, cartPayload, config);
      const cartId = res.data.cart.id;
      
      // 🟢 Notify App about the cart ID
      if (onCartCreated) onCartCreated(cartId);

      await axios.post(`${MEDUSA_URL}/store/carts/${cartId}/line-items`, {
        variant_id: SERVICE_VARIANT_ID, 
        quantity: 1,
        metadata: { booking_date: selectedSlot.date, booking_time: selectedSlot.time }
      }, config);
      
      await refreshCart(cartId);
    } catch (e: any) { 
        Alert.alert('Error', 'Cart Init Failed'); 
    } finally { 
        setLoading(false); 
    }
  };

  const refreshCart = async (cartId: string) => {
    try {
      const res = await axios.get(`${MEDUSA_URL}/store/carts/${cartId}`, { 
        headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY, 'Cache-Control': 'no-cache' },
        params: { fields: '+region.payment_providers.id' }
      });
      const c = res.data.cart;
      setCart(c);

      if (c.region && c.region.payment_providers) {
        const found = c.region.payment_providers.find((p:any) => p.id.toLowerCase().includes('cashfree'));
        if (found) {
            console.log("🟢 Detected Provider ID:", found.id);
            setDetectedProviderId(found.id);
        }
      }
    } catch (error) { console.error("Refresh failed:", error); }
  };

  const handleApplyCoupon = async () => {
    if (!cart || !couponCode || !email) return Alert.alert("Required", "Email & Code needed");
    setLoading(true);
    try {
      const config = { headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY } };
      await axios.post(`${MEDUSA_URL}/store/carts/${cart.id}`, { email }, config);
      await axios.post(`${MEDUSA_URL}/store/carts/${cart.id}/promotions`, { promo_codes: [couponCode] }, config);
      await refreshCart(cart.id);
      Alert.alert("Success", "Coupon Applied!");
    } catch (error: any) {
      Alert.alert("Failed", error.response?.data?.message || "Invalid Coupon");
    } finally { setLoading(false); }
  };

  const handleInitiatePayment = async () => {
    if(!form.first_name || !form.phone || !email) { 
        Alert.alert("Missing Info", "Fill all details."); 
        return; 
    }
    
    const providerToUse = detectedProviderId || "pp_cashfree_cashfree"; 
    
    setLoading(true);
    try {
        const config = { headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY } };
        
        await axios.post(`${MEDUSA_URL}/store/carts/${cart.id}`, {
            email, 
            shipping_address: { 
                ...form, 
                address_1: "Online", 
                city: "Online", 
                country_code: "in", 
                postal_code: "110001" 
            }
        }, config);
        
        const colRes = await axios.post(
            `${MEDUSA_URL}/store/payment-collections`, 
            { cart_id: cart.id }, 
            config
        );
        const collectionId = colRes.data.payment_collection.id;

        console.log(`Creating session with provider: ${providerToUse}`);
        
        await axios.post(
            `${MEDUSA_URL}/store/payment-collections/${collectionId}/payment-sessions`, 
            { provider_id: providerToUse },
            config
        );

        const cartRes = await axios.get(`${MEDUSA_URL}/store/carts/${cart.id}`, {
            ...config,
            params: { fields: '+payment_collection.payment_sessions' }
        });
        
        const session = cartRes.data.cart.payment_collection?.payment_sessions?.find(
            (s: any) => s.provider_id === providerToUse
        );

        if (session && session.data) {
            console.log("📦 Full Session Data:", JSON.stringify(session.data, null, 2));
            
            const { payment_session_id, order_id } = session.data;

            if (!payment_session_id || !order_id) {
                throw new Error("Missing payment credentials from backend");
            }

            console.log("🚀 Starting Payment with:");
            console.log("  - payment_session_id:", payment_session_id);
            console.log("  - order_id:", order_id);

            const cfSession = new CFSession(
                payment_session_id, 
                order_id,
                CFEnvironment.SANDBOX 
            );

            const cfPayment = new CFDropCheckoutPayment(
                cfSession,
                null,
                new CFThemeBuilder()
                    .setNavigationBarBackgroundColor("#000000")
                    .setNavigationBarTextColor("#FFFFFF")
                    .build()
            );

            CFPaymentGatewayService.doPayment(cfPayment);
        } else {
            Alert.alert("Error", "Could not fetch payment session data.");
        }

    } catch (error: any) { 
        console.error("Payment Error:", error); 
        const errMsg = error.response?.data?.message || error.message || "Unknown Error";
        Alert.alert("Payment Failed", errMsg); 
    } 
    finally { setLoading(false); }
  };

  if (!cart) return <View style={styles.center}><ActivityIndicator size="large" color="#000"/></View>;

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><ThemedText style={styles.textBlack}>← Back</ThemedText></TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Checkout</ThemedText>
        <View style={{width:40}}/>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
        <ScrollView contentContainerStyle={{padding:20}}>
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Order Summary</ThemedText>
            <View style={styles.row}>
              <ThemedText style={styles.textBlack}>Subtotal</ThemedText>
              <ThemedText style={styles.textBlack}>{(cart.subtotal / 100).toFixed(2)} {cart.region?.currency_code?.toUpperCase()}</ThemedText>
            </View>
            {cart.discount_total > 0 && (
                <View style={styles.row}>
                    <ThemedText style={{color:'green'}}>Discount</ThemedText>
                    <ThemedText style={{color:'green'}}>-{(cart.discount_total/100).toFixed(2)}</ThemedText>
                </View>
            )}
            <View style={{height:1, backgroundColor:'#eee', marginVertical:10}} />
            <View style={styles.row}>
              <ThemedText style={{fontWeight:'bold', fontSize:16}}>Total</ThemedText>
              <ThemedText style={{fontWeight:'bold', fontSize:16}}>{(cart.total / 100).toFixed(2)} {cart.region?.currency_code?.toUpperCase()}</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.label}>Contact Details</ThemedText>
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" placeholderTextColor="#888"/>
          <View style={{flexDirection:'row', gap:10}}>
             <TextInput style={[styles.input, {flex:1}]} placeholder="First Name" value={form.first_name} onChangeText={t=>setForm({...form, first_name:t})} placeholderTextColor="#888"/>
             <TextInput style={[styles.input, {flex:1}]} placeholder="Last Name" value={form.last_name} onChangeText={t=>setForm({...form, last_name:t})} placeholderTextColor="#888"/>
          </View>
          <TextInput style={styles.input} placeholder="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={t=>setForm({...form, phone:t})} placeholderTextColor="#888"/>

          <ThemedText style={styles.label}>Promo Code</ThemedText>
          <View style={{flexDirection:'row', gap:10}}>
              <TextInput style={[styles.input, {flex:1}]} placeholder="CODE" value={couponCode} onChangeText={setCouponCode} autoCapitalize="characters" placeholderTextColor="#888"/>
              <TouchableOpacity style={styles.smallButton} onPress={handleApplyCoupon}><ThemedText style={styles.textWhite}>APPLY</ThemedText></TouchableOpacity>
          </View>

          <View style={styles.totalRow}>
              <ThemedText style={styles.totalLabel}>Total</ThemedText>
              <ThemedText style={styles.totalValue}>{(cart.total/100).toFixed(2)} {cart.region?.currency_code?.toUpperCase()}</ThemedText>
          </View>
          
          <TouchableOpacity style={styles.fabButton} onPress={handleInitiatePayment} disabled={loading}>
             {loading ? <ActivityIndicator color="#fff"/> : <ThemedText style={styles.fabText}>Pay Now</ThemedText>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const OrdersView = ({ user, onBack }: any) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const config = { headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY } };
      
      const response = await axios.get(`${MEDUSA_URL}/store/orders`, {
        ...config,
        params: {
          fields: '+items.variant.product.title,+items.metadata,+shipping_address,+payment_collections.payments'
        }
      });
      
      console.log("📦 Orders fetched:", response.data.orders.length);
      setOrders(response.data.orders || []);
    } catch (error: any) {
      console.error("Failed to fetch orders:", error);
      Alert.alert("Error", "Could not load orders");
    } finally {
      setLoading(false);
    }
  };

  const getOrderStatus = (order: any) => {
    if (order.payment_status === 'captured') return { text: 'Paid', color: '#22c55e' };
    if (order.payment_status === 'awaiting') return { text: 'Pending', color: '#f59e0b' };
    if (order.payment_status === 'canceled') return { text: 'Canceled', color: '#ef4444' };
    return { text: order.payment_status, color: '#6b7280' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const status = getOrderStatus(item);
    const isExpanded = expandedOrderId === item.id;
    
    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => setExpandedOrderId(isExpanded ? null : item.id)}
      >
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.orderNumber}>Order #{item.display_id}</ThemedText>
            <ThemedText style={styles.orderDate}>{formatDate(item.created_at)}</ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
            <ThemedText style={styles.statusText}>{status.text}</ThemedText>
          </View>
        </View>

        <View style={styles.orderAmount}>
          <ThemedText style={styles.amountLabel}>Total Amount</ThemedText>
          <ThemedText style={styles.amountValue}>
            {(item.total / 100).toFixed(2)} {item.currency_code.toUpperCase()}
          </ThemedText>
        </View>

        {isExpanded && (
          <View style={styles.orderDetails}>
            <View style={styles.divider} />
            
            {/* Items */}
            <ThemedText style={styles.sectionTitle}>Items</ThemedText>
            {item.items?.map((lineItem: any, idx: number) => (
              <View key={idx} style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.itemTitle}>
                    {lineItem.variant?.product?.title || lineItem.title}
                  </ThemedText>
                  {lineItem.metadata?.booking_date && (
                    <ThemedText style={styles.itemMeta}>
                      📅 {lineItem.metadata.booking_date} at {lineItem.metadata.booking_time}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.itemMeta}>Qty: {lineItem.quantity}</ThemedText>
                </View>
                <ThemedText style={styles.itemPrice}>
                  {((lineItem.unit_price * lineItem.quantity) / 100).toFixed(2)} {item.currency_code.toUpperCase()}
                </ThemedText>
              </View>
            ))}

            {/* Shipping Address */}
            {item.shipping_address && (
              <>
                <View style={styles.divider} />
                <ThemedText style={styles.sectionTitle}>Shipping Address</ThemedText>
                <ThemedText style={styles.addressText}>
                  {item.shipping_address.first_name} {item.shipping_address.last_name}
                </ThemedText>
                {item.shipping_address.phone && (
                  <ThemedText style={styles.addressText}>📞 {item.shipping_address.phone}</ThemedText>
                )}
                <ThemedText style={styles.addressText}>
                  {item.shipping_address.address_1}, {item.shipping_address.city}
                </ThemedText>
                <ThemedText style={styles.addressText}>
                  {item.shipping_address.postal_code}
                </ThemedText>
              </>
            )}

            {/* Payment Info */}
            {item.payment_collections?.[0]?.payments?.[0] && (
              <>
                <View style={styles.divider} />
                <ThemedText style={styles.sectionTitle}>Payment Details</ThemedText>
                <View style={styles.row}>
                  <ThemedText style={styles.addressText}>Provider</ThemedText>
                  <ThemedText style={styles.addressText}>
                    {item.payment_collections[0].payments[0].provider_id}
                  </ThemedText>
                </View>
                <View style={styles.row}>
                  <ThemedText style={styles.addressText}>Amount Paid</ThemedText>
                  <ThemedText style={styles.addressText}>
                    {(item.payment_collections[0].payments[0].amount / 100).toFixed(2)} {item.currency_code.toUpperCase()}
                  </ThemedText>
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.expandIndicator}>
          <ThemedText style={styles.expandText}>
            {isExpanded ? '▲ Tap to collapse' : '▼ Tap for details'}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ThemedText style={styles.textBlack}>← Back</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>My Orders</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={styles.emptyText}>No orders yet</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Your order history will appear here
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.ordersList}
          refreshing={loading}
          onRefresh={fetchOrders}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS==='android'?30:0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center', backgroundColor:'#fff' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  
  section: { padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  
  dateChip: { padding: 12, borderRadius: 8, backgroundColor: '#f0f0f0', minWidth: 70, alignItems: 'center', marginRight:10 },
  timeChip: { width: '30%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', alignItems: 'center' },
  bgBlack: { backgroundColor: '#000', borderColor:'#000' },
  textBlack: { color: '#000' },
  textWhite: { color: '#fff', fontWeight: 'bold' },

  card: { backgroundColor: '#f9f9f9', padding: 16, borderRadius: 8, marginBottom: 20, borderWidth:1, borderColor:'#eee' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  
  label: { marginBottom: 8, fontWeight: '600', color: '#000', marginTop: 10 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#ccc', color: '#000' },
  smallButton: { backgroundColor: '#000', padding: 12, borderRadius: 8, justifyContent: 'center', minWidth: 80, alignItems:'center' },
  
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderColor: '#eee', marginBottom: 30 },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#000' },

  fabContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  fabButton: { backgroundColor: '#000', padding: 18, borderRadius: 30, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Orders View Styles
  ordersButton: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ordersButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  ordersList: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 13,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  orderAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  orderDetails: {
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 4,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  addressText: {
    fontSize: 13,
    color: '#444',
    marginBottom: 4,
    lineHeight: 18,
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  expandText: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
});