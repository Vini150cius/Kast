import { Observable } from 'rxjs';
import { DisplayCommand, DisplayProgress } from '../models/display.model';

export abstract class DisplayPort {
  // Lado do controlador
  abstract send(command: DisplayCommand): Promise<void>;
  abstract ended$(): Observable<{ playId: number; label: string }>;
  abstract ready$(): Observable<{ label: string }>;
  abstract progress$(): Observable<DisplayProgress>;

  // Lado do exibidor
  abstract commands$(): Observable<DisplayCommand>;
  abstract notifyEnded(playId: number, label: string): Promise<void>;
  abstract notifyReady(label: string): Promise<void>;
  abstract notifyProgress(progress: DisplayProgress): Promise<void>;
  abstract toAssetUrl(path: string): string;
}
