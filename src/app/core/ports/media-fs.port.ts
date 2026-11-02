import { Observable } from 'rxjs';
import { DropEvent, RegisterResult } from '../models/media.model';

export abstract class MediaFsPort {
  /** Valida no back-end e libera o arquivo. Retorna só metadados e caminhos. */
  abstract registerMedia(paths: string[]): Promise<RegisterResult>;
  abstract pickFiles(): Promise<string[]>;
  abstract dropEvents(): Observable<DropEvent>;
  /** URL do asset protocol para ler metadados (duração, resolução). */
  abstract toAssetUrl(path: string): string;
}
