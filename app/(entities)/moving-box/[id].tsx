import { useLocalSearchParams } from 'expo-router';
import { MovingScreen } from '../../../src/features/moving/MovingScreen';
export default function MovingBoxRoute() { const {id}=useLocalSearchParams<{id:string}>(); return <MovingScreen id={id} boxId={id}/>; }
