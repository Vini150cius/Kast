import { Routes } from '@angular/router';

// Um único bundle, três "telas": o Rust escolhe a rota ao criar cada janela.
export const routes: Routes = [
  { path: 'splash', loadComponent: () => import('./features/splash/splash.component').then((m) => m.SplashComponent) },
  { path: 'controller', loadComponent: () => import('./features/controller/controller.component').then((m) => m.ControllerComponent) },
  { path: 'display/:id', loadComponent: () => import('./features/display/display.component').then((m) => m.DisplayComponent) },
  { path: '', pathMatch: 'full', redirectTo: 'controller' },
  { path: '**', redirectTo: 'controller' }
];
