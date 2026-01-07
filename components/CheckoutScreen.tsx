import { ThemedText } from '@/components/themed-text';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const MEDUSA_URL = 'http://172.29.118.64:9000';
const PUBLISHABLE_API_KEY = 'pk_e3daf218eb487c40b1dc5217e7cb56ec05b6b1f9a8733e599190a7fe7efa3132';
const SERVICE_VARIANT_ID = "variant_01KEBG7JCDWA5WRE4YD7XPWK11";

export default function CheckoutScreen({ slot, user, onBack }: any) {
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState('');
  
  // Auto-fill form
  const [form, setForm] = useState({ 
    email: user?.email || '', 
    first_name: user?.first_name || '', 
    last_name: user?.last_name || '', 
    phone: user?.phone || '' 
  });

  useEffect(() => {
    const initCart = async () => {
      setLoading(true);
      try {
        const config = { headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY } };
        // Create Cart Linked to User
        const { data } = await axios.post(`${MEDUSA_URL}/store/carts`, { customer_id: user?.id, email: user?.email }, config);
        
        // Add Service
        await axios.post(`${MEDUSA_URL}/store/carts/${data.cart.id}/line-items`, {
           variant_id: SERVICE_VARIANT_ID, quantity: 1,
           metadata: { booking_date: slot.date, booking_time: slot.time }
        }, config);

        await refreshCart(data.cart.id);
      } catch (e) { Alert.alert('Error', 'Failed to init checkout'); }
      finally { setLoading(false); }
    };
    initCart();
  }, []);

  const refreshCart = async (id: string) => {
    try {
      // FORCE REFRESH: Cache-Control + Timestamp
      const res = await axios.get(`${MEDUSA_URL}/store/carts/${id}`, {
         headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY, 'Cache-Control': 'no-cache' },
         params: { _: Date.now() }
      });
      setCart(res.data.cart);
    } catch (e) { console.error(e); }
  };

  const applyCoupon = async () => {
    if(!coupon || !cart) return;
    setLoading(true);
    try {
      await axios.post(`${MEDUSA_URL}/store/carts/${cart.id}/promotions`, { promo_codes: [coupon] }, 
        { headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY } });
      Alert.alert('Success', 'Coupon Applied!');
      await refreshCart(cart.id);
    } catch (e) { Alert.alert('Error', 'Invalid Coupon'); }
    finally { setLoading(false); }
  };

  const placeOrder = async () => {
    if(!form.first_name || !form.phone) return Alert.alert('Missing Info', 'Fill all details');
    setLoading(true);
    try {
      const config = { headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY } };
      await axios.post(`${MEDUSA_URL}/store/carts/${cart.id}`, { email: form.email, shipping_address: { ...form, address_1: "Online", city: "Online", country_code: "in", postal_code: "110001" } }, config);
      await axios.post(`${MEDUSA_URL}/store/payment-collections`, { cart_id: cart.id }, config);
      const res = await axios.post(`${MEDUSA_URL}/store/carts/${cart.id}/complete`, {}, config);
      if(res.data.type === 'order') { Alert.alert('Success', `Order #${res.data.data.display_id} Placed!`); onBack(); }
    } catch (e) { Alert.alert('Failed', 'Order could not be placed'); }
    finally { setLoading(false); }
  };

  if(!cart) return <ActivityIndicator style={{marginTop:50}} size="large" color="#000"/>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><ThemedText>← Back</ThemedText></TouchableOpacity>
        <ThemedText style={styles.title}>Checkout</ThemedText>
        <View style={{width:40}}/>
      </View>

      <ScrollView contentContainerStyle={{padding:20}}>
        {/* SUMMARY CARD */}
        <View style={styles.card}>
           <ThemedText style={styles.cardHeader}>Order Summary</ThemedText>
           <View style={styles.row}><ThemedText>Subtotal</ThemedText><ThemedText>{(cart.subtotal/100).toFixed(2)} INR</ThemedText></View>
           
           <View style={styles.row}>
             <ThemedText style={{color: cart.discount_total > 0 ? 'green' : 'red'}}>Discount</ThemedText>
             <ThemedText style={{color: cart.discount_total > 0 ? 'green' : 'red'}}>
               {cart.discount_total > 0 ? `- ${(cart.discount_total/100).toFixed(2)}` : '0.00'}
             </ThemedText>
           </View>
           
           <View style={[styles.row, {marginTop:10, borderTopWidth:1, borderColor:'#eee', paddingTop:10}]}>
             <ThemedText style={{fontWeight:'bold'}}>Total</ThemedText>
             <ThemedText style={{fontWeight:'bold'}}>{(cart.total/100).toFixed(2)} INR</ThemedText>
           </View>
        </View>

        {/* INPUTS */}
        <TextInput style={styles.input} value={form.email} onChangeText={t=>setForm({...form, email:t})} placeholder="Email"/>
        <View style={{flexDirection:'row', gap:10}}>
           <TextInput style={[styles.input, {flex:1}]} value={form.first_name} onChangeText={t=>setForm({...form, first_name:t})} placeholder="First Name"/>
           <TextInput style={[styles.input, {flex:1}]} value={form.last_name} onChangeText={t=>setForm({...form, last_name:t})} placeholder="Last Name"/>
        </View>
        <TextInput style={styles.input} value={form.phone} onChangeText={t=>setForm({...form, phone:t})} placeholder="Phone" keyboardType="phone-pad"/>

        {/* COUPON */}
        <View style={{flexDirection:'row', gap:10, marginVertical:10}}>
           <TextInput style={[styles.input, {flex:1, marginBottom:0}]} value={coupon} onChangeText={setCoupon} placeholder="PROMO CODE" autoCapitalize="characters"/>
           <TouchableOpacity style={styles.btnSmall} onPress={applyCoupon}><ThemedText style={{color:'#fff'}}>APPLY</ThemedText></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btnMain} onPress={placeOrder} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff"/> : <ThemedText style={{color:'#fff', fontWeight:'bold'}}>CONFIRM & PAY</ThemedText>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS==='android'?30:0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 18, fontWeight: 'bold' },
  card: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 8, marginBottom: 20 },
  cardHeader: { fontWeight: 'bold', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 10 },
  btnSmall: { backgroundColor: '#000', padding: 12, borderRadius: 8, justifyContent: 'center' },
  btnMain: { backgroundColor: '#000', padding: 18, borderRadius: 30, alignItems: 'center', marginTop: 20 }
});