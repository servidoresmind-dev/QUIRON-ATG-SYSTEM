/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cliente } from "../types";

const INITIAL_CLIENTES: Cliente[] = [];

export function getStoredData<T>(key: string, initialData: T): T {
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return initialData;
    }
  }
  localStorage.setItem(key, JSON.stringify(initialData));
  return initialData;
}

export function saveStoredData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Global Store State Manager with simple pub-sub for cross-component reactivity
type Listener = () => void;
class Store {
  private listeners: Set<Listener> = new Set();

  getClientes(): Cliente[] {
    return getStoredData("clientes", INITIAL_CLIENTES);
  }

  setClientes(data: Cliente[]): void {
    saveStoredData("clientes", data);
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const dbStore = new Store();
