import { useEffect, useState } from "react";

export function useFetch(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, loading: true, error: null }));
    load()
      .then(data => alive && setState({ data, error: null, loading: false }))
      .catch(error => alive && setState(s => ({ data: s.data, error, loading: false })));
    return () => {
      alive = false;
    };
  }, deps);

  return state;
}
