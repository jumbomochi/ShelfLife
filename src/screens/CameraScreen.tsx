import { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { detectGroceryItemsMock, DetectedItem } from '@/services/rekognitionService';
import { lookupBarcodeMock, suggestLocation } from '@/services/barcodeService';
import { useInventoryStore } from '@/store';
import { RootStackParamList } from '@/types';

type CameraScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ScanMode = 'photo' | 'barcode';

interface CameraScreenProps {
  onClose: () => void;
  onItemsAdded?: () => void;
}

export default function CameraScreen({ onClose, onItemsAdded }: CameraScreenProps) {
  const navigation = useNavigation<CameraScreenNavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState<ScanMode>('photo');
  const [isScanning, setIsScanning] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { addItem } = useInventoryStore();

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (photo?.uri) {
        setCapturedImage(photo.uri);
        analyzeImage(photo.base64 || '');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      analyzeImage(result.assets[0].base64 || '');
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    try {
      // Use mock for now - replace with real service when AWS is configured
      const items = await detectGroceryItemsMock(base64);
      setDetectedItems(items);
      // Auto-select all detected items
      setSelectedItems(new Set(items.map((item) => item.name)));
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleItemSelection = (itemName: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  const addSelectedItems = () => {
    selectedItems.forEach((itemName) => {
      addItem({
        userId: 'current-user', // TODO: Replace with actual user ID
        name: itemName,
        quantity: 1,
        unit: 'pcs',
        location: 'fridge',
        ownership: 'personal',
      });
    });

    Alert.alert('Success', `Added ${selectedItems.size} item(s) to inventory`);
    onItemsAdded?.();
    onClose();
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setDetectedItems([]);
    setSelectedItems(new Set());
  };

  const handleBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (isScanning) return;
      setIsScanning(true);

      const product = await lookupBarcodeMock(data);

      if (product) {
        const location = suggestLocation(product.categories ?? []);
        Alert.alert(
          product.name,
          `${product.brand ? product.brand + ' · ' : ''}${product.quantity ?? ''}`.trim() || 'Barcode found',
          [
            {
              text: 'Add Directly',
              onPress: () => {
                addItem({
                  userId: 'current-user',
                  name: product.name,
                  quantity: 1,
                  unit: 'pcs',
                  location,
                  ownership: 'personal',
                });
                Alert.alert('Success', `${product.name} added to inventory`);
                onItemsAdded?.();
                onClose();
              },
            },
            {
              text: 'Edit First',
              onPress: () => {
                onClose();
                navigation.navigate('AddItem', {
                  mode: 'manual',
                  prefill: {
                    name: product.name,
                    quantity: 1,
                    unit: 'pcs',
                    location,
                  },
                });
              },
            },
            {
              text: 'Scan Again',
              style: 'cancel',
              onPress: () => setIsScanning(false),
            },
          ]
        );
      } else {
        Alert.alert(
          'Product Not Found',
          'No product information found for this barcode.',
          [
            {
              text: 'Scan Again',
              onPress: () => setIsScanning(false),
            },
            {
              text: 'Add Manually',
              onPress: () => {
                onClose();
                navigation.navigate('AddItem', { mode: 'manual' });
              },
            },
          ]
        );
      }
    },
    [isScanning, addItem, navigation, onClose, onItemsAdded]
  );

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            We need camera permission to scan grocery items
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetCapture}>
            <Text style={styles.headerButton}>Retake</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detected Items</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerButton}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Image source={{ uri: capturedImage }} style={styles.previewImage} />

        {isAnalyzing ? (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.analyzingText}>Analyzing image...</Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            {detectedItems.length > 0 ? (
              <>
                <Text style={styles.resultsTitle}>
                  Select items to add ({selectedItems.size} selected)
                </Text>
                <FlatList
                  data={detectedItems}
                  keyExtractor={(item) => item.name}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.detectedItem,
                        selectedItems.has(item.name) && styles.detectedItemSelected,
                      ]}
                      onPress={() => toggleItemSelection(item.name)}
                    >
                      <Text
                        style={[
                          styles.detectedItemName,
                          selectedItems.has(item.name) &&
                            styles.detectedItemNameSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.detectedItemConfidence}>
                        {item.confidence.toFixed(0)}%
                      </Text>
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    selectedItems.size === 0 && styles.addButtonDisabled,
                  ]}
                  onPress={addSelectedItems}
                  disabled={selectedItems.size === 0}
                >
                  <Text style={styles.addButtonText}>
                    Add {selectedItems.size} Item(s)
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noItemsText}>
                No grocery items detected. Try taking another photo.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        ref={cameraRef}
        facing="back"
        barcodeScannerSettings={
          scanMode === 'barcode'
            ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'] }
            : undefined
        }
        onBarcodeScanned={scanMode === 'barcode' ? handleBarcodeScanned : undefined}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>

            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'photo' && styles.modeButtonActive]}
                onPress={() => setScanMode('photo')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    scanMode === 'photo' && styles.modeButtonTextActive,
                  ]}
                >
                  Photo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'barcode' && styles.modeButtonActive]}
                onPress={() => {
                  setScanMode('barcode');
                  setIsScanning(false);
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    scanMode === 'barcode' && styles.modeButtonTextActive,
                  ]}
                >
                  Barcode
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {scanMode === 'barcode' ? (
            <View style={styles.barcodeHintContainer}>
              <Text style={styles.barcodeHintText}>Point camera at a barcode</Text>
            </View>
          ) : (
            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
                <Text style={styles.galleryButtonText}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <View style={styles.placeholder} />
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    padding: 2,
  },
  modeButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: '#fff',
  },
  modeButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  barcodeHintContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  barcodeHintText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 30,
  },
  galleryButton: {
    padding: 15,
  },
  galleryButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  placeholder: {
    width: 60,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 12,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  headerButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  previewImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  analyzingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  analyzingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  detectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    marginBottom: 8,
  },
  detectedItemSelected: {
    backgroundColor: '#007AFF',
  },
  detectedItemName: {
    fontSize: 16,
    color: '#333',
  },
  detectedItemNameSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  detectedItemConfidence: {
    fontSize: 14,
    color: '#666',
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noItemsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
});
