// Este arquivo não é mais necessário, pois os dados serão gerenciados pelo Supabase.
// Pode ser removido do projeto.

// import { useState, useEffect } from 'react';

// function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
//   const [storedValue, setStoredValue] = useState<T>(() => {
//     try {
//       const item = window.localStorage.getItem(key);
//       return item ? JSON.parse(item) : initialValue;
//     } catch (error) {
//       console.error(`Error reading localStorage key "${key}":`, error);
//       return initialValue;
//     }
//   });

//   useEffect(() => {
//     try {
//       const valueToStore = storedValue;
//       window.localStorage.setItem(key, JSON.stringify(valueToStore));
//     } catch (error) {
//       console.error(`Error setting localStorage key "${key}":`, error);
//     }
//   }, [key, storedValue]);

//   return [storedValue, setStoredValue];
// }

// export default useLocalStorage;
