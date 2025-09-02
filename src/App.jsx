import { use, useEffect, useState, useRef } from 'react'
import { useDebounce } from 'react-use'
import Search from './components/Search'
import Spinner from './components/Spinner'
import MovieCard from './components/MovieCard'
import { getTrendingMovies, updateSearchCount } from './appwrite'

const API_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const API_OPTIONS = {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    accept: 'application/json',
  }
};

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [movieList, setMovieList] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const loaderRef = useRef(null);

  useDebounce(() => setDebouncedSearchTerm(searchTerm), 500, [searchTerm]);

  const fetchMovies = async (query = '', page = 1) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const endpoint = query 
        ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&page=${page}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc&page=${page}`;
      const response = await fetch(endpoint, API_OPTIONS);
      if (!response.ok) {
        throw new Error('Failed to fetch movies');
      }

      const data = await response.json();

      if(data.response === 'False') {
        setErrorMessage(data.error || 'Failed to fetch movies');
        setMovieList([]);
        return;
      }

      // Genres - Animation, Adventure, Comedy, Family, Fantasy, "Action", "Science Fiction", "Western", "Music", "Crime", "War"
      const allowedGenres = [16, 12, 35, 10751, 14, 28, 878, 37, 10402, 80, 10752];
      const safeResults = (data.results || []).filter(
        movie => !movie.adult && movie.genre_ids.some(id => allowedGenres.includes(id))
      );

      setMovieList(prev =>
        page === 1 ? safeResults : [...prev, ...safeResults]
      );

      setPage(data.page);
      setTotalPages(data.total_pages);

      if(query && data.results.length > 0) {
        await updateSearchCount(query, data.results[0]);
      }

    } catch (error) {
      console.error(`Error fetching movies: ${error}`);
      setErrorMessage('Failed to fetching movies. Please try again later.');
    } finally {
      setIsLoading(false);
    } 
  }

  const loadTrendingMovies = async () => {
    try {
      const movies = await getTrendingMovies();
      setTrendingMovies(movies);
    } catch (error) {
      console.error('Error fetching trending movies:', error);
    }
  }

  useEffect(() => {
    fetchMovies(debouncedSearchTerm, 1);
  },[debouncedSearchTerm])

  useEffect(() => {
    loadTrendingMovies();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !isLoading && page < totalPages) {
          fetchMovies(debouncedSearchTerm, page + 1);
        }
      },
      { threshold: 1.0 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) observer.observe(currentLoader);

    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [isLoading, page, totalPages, debouncedSearchTerm]);

  return (
   <main>
    <div className='pattern'></div>
    <div className='wrapper'>
      <header>
        <img src="./hero.png" alt="Hero Banner" />
        <h1>Find <span className='text-gradient'>Movies</span> You'll Enjoy Without the Hassle</h1>
        <Search searchTerm={searchTerm} setSearchTerm={setSearchTerm}/>
      </header>
      {trendingMovies.length > 0 && (
        <section className='trending'>
        <h2>Trending Movies</h2>
        <ul>
          {trendingMovies.map((movie,index) => (
            <li key={movie.$id}>
              <p>{index+1}</p>
              <img className='ml-2' src={movie.poster_url} alt={movie.title} />
            </li>
          ))}
        </ul>
        </section>
      )}
      <section className='all-movies'>
        <h2>All Movies</h2>

        {errorMessage ? (
          <p className="text-red-500">{errorMessage}</p>
        ) : (
          <>
            <ul>
              {movieList.map((movie, index) => (
                <MovieCard key={`${movie.id}-${index}`} movie={movie} />
              ))}
            </ul>

            <div ref={loaderRef} className="h-12 flex items-center justify-center">
              {isLoading && <Spinner />}
            </div>
          </>
        )}
      </section>
    </div>
   </main>
  )
}

export default App
 