import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '@/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateIfReady<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
): void {
  if (navigationRef.isReady()) {
    // @ts-expect-error — React Navigation's overload typing isn't generic-friendly here
    navigationRef.navigate(name, params);
  }
}
