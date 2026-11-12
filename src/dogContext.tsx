import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useDogs, type Dog } from "./api";

type Ctx = { dogs: Dog[]; dog: Dog | null; setDogId: (id: string) => void; loading: boolean };
const DogCtx = createContext<Ctx>({ dogs: [], dog: null, setDogId: () => {}, loading: true });
export const useCurrentDog = () => useContext(DogCtx);

const KEY = "wanlog.dog";
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function DogProvider({ children }: { children: ReactNode }) {
  const { data: dogs = [], isPending } = useDogs();
  const [id, setId] = useState<string | null>(read);
  const dog = dogs.find((d) => d.id === id) ?? dogs[0] ?? null;
  useEffect(() => {
    if (!dog) return;
    try {
      localStorage.setItem(KEY, dog.id);
    } catch {
      /* noop */
    }
  }, [dog]);
  return <DogCtx.Provider value={{ dogs, dog, setDogId: setId, loading: isPending }}>{children}</DogCtx.Provider>;
}
