import { ThemedText } from '@/components/themed-text';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const SLOTS_URL = 'https://knightsbridge.heartitout.in/webhook/api/hio/services/get_all_slots';

export default function SlotSelectionScreen({ onProceed, onLogout }: any) {
  const [loading, setLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [groupedSlots, setGroupedSlots] = useState<any>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      try {
        const { data } = await axios.post(SLOTS_URL, { "therapist_id": "10", "loc_id": "2", "service_id": "13", "get_more": 0 });
        
        const slotsMap: any = {};
        if (data.Slots) {
          data.Slots.forEach((s: string) => {
            const [d, t] = s.split(' ');
            if (!slotsMap[d]) slotsMap[d] = [];
            slotsMap[d].push(t.substring(0, 5));
          });
        }
        setGroupedSlots(slotsMap);
        setAvailableDates(data.dates || []);
        if (data.dates?.length > 0) setSelectedDate(data.dates[0]);
      } catch (e) { Alert.alert('Error', 'Could not fetch slots'); }
      finally { setLoading(false); }
    };
    fetchSlots();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Book Appointment</ThemedText>
        <TouchableOpacity onPress={onLogout}><ThemedText style={{color:'red'}}>Logout</ThemedText></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator size="large" color="#000" style={{marginTop: 50}}/> : (
        <ScrollView>
          <View style={styles.section}>
            <ThemedText style={styles.label}>Select Date</ThemedText>
            <FlatList horizontal data={availableDates} showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.chip, selectedDate===item && styles.active]} onPress={()=>setSelectedDate(item)}>
                   <ThemedText style={selectedDate===item ? styles.textWhite : styles.textBlack}>
                     {new Date(item).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                   </ThemedText>
                </TouchableOpacity>
              )}
            />
          </View>

          <View style={styles.section}>
             <ThemedText style={styles.label}>Select Time</ThemedText>
             <View style={styles.grid}>
                {selectedDate && groupedSlots[selectedDate]?.map((t: string) => (
                   <TouchableOpacity key={t} style={[styles.timeChip, selectedTime===t && styles.active]} onPress={()=>setSelectedTime(t)}>
                      <ThemedText style={selectedTime===t ? styles.textWhite : styles.textBlack}>{t}</ThemedText>
                   </TouchableOpacity>
                ))}
             </View>
          </View>
        </ScrollView>
      )}

      {selectedDate && selectedTime && (
        <TouchableOpacity style={styles.fab} onPress={() => onProceed({ date: selectedDate, time: selectedTime })}>
           <ThemedText style={styles.textWhite}>Proceed to Checkout</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 18, fontWeight: 'bold' },
  section: { padding: 20 },
  label: { marginBottom: 10, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10, minWidth: 60, alignItems: 'center' },
  timeChip: { width: '30%', padding: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 8, alignItems: 'center' },
  active: { backgroundColor: '#000', borderColor: '#000' },
  textWhite: { color: '#fff', fontWeight: 'bold' },
  textBlack: { color: '#000' },
  fab: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#000', padding: 15, borderRadius: 30, alignItems: 'center' }
});