import { useLocalSearchParams } from 'expo-router';
import { MovingScreen } from '../../../src/features/moving/MovingScreen';
export default function MovingRoute() { const {id}=useLocalSearchParams<{id:string}>(); return <MovingScreen id={id}/>; }
