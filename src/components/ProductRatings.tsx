import React, { useState, useEffect } from 'react';
import { Star, Check, Trash2, Edit2 } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getApiUrl } from '../config/api';

interface Rating {
  id: number;
  user_id: number;
  user_name: string;
  rating: number;
  review_text: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  updated_at: string;
}

interface RatingStats {
  average_rating: number;
  total_ratings: number;
  rating_distribution: {
    '5': number;
    '4': number;
    '3': number;
    '2': number;
    '1': number;
  };
}

interface ProductRatingsProps {
  productId: string;
  vendorUserId?: number; // To check if user owns the product
}

const ProductRatings: React.FC<ProductRatingsProps> = ({ productId, vendorUserId }) => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [userRating, setUserRating] = useState<Rating | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    rating: 0,
    review_text: ''
  });
  const [hoveredStar, setHoveredStar] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchRatings();
    if (user) {
      fetchUserRating();
    }
  }, [productId, user, page]);

  const fetchRatings = async () => {
    try {
      const response = await fetch(
        getApiUrl(`/api/ratings?product_id=${productId}&page=${page}&limit=10`)
      );
      const data = await response.json();
      
      if (response.ok) {
        setRatings(data.ratings || []);
        setStats(data.stats || null);
        setTotalPages(data.pagination?.total_pages || 1);
      }
    } catch (error) {
      console.error('Error fetching ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRating = async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        getApiUrl(`/api/ratings?product_id=${productId}&user_rating=1`),
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      
      if (response.ok && data.rating) {
        setUserRating(data.rating);
        setRatingForm({
          rating: data.rating.rating,
          review_text: data.rating.review_text || ''
        });
      }
    } catch (error) {
      console.error('Error fetching user rating:', error);
    }
  };

  const handleSubmitRating = async () => {
    if (!user) {
      toast.error('Please login to rate products');
      return;
    }

    if (ratingForm.rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    // Check if user is trying to rate their own product
    if (vendorUserId && user.id === vendorUserId) {
      toast.error('You cannot rate your own products');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/ratings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: productId,
          rating: ratingForm.rating,
          review_text: ratingForm.review_text.trim() || null
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        setShowRatingForm(false);
        setEditing(false);
        fetchRatings();
        fetchUserRating();
      } else {
        toast.error(data.error || 'Failed to submit rating');
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRating = async () => {
    if (!userRating) return;

    if (!confirm('Are you sure you want to delete your rating?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/ratings'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rating_id: userRating.id
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Rating deleted successfully');
        setUserRating(null);
        setRatingForm({ rating: 0, review_text: '' });
        fetchRatings();
      } else {
        toast.error(data.error || 'Failed to delete rating');
      }
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast.error('Failed to delete rating');
    }
  };

  const canRate = user && (!vendorUserId || user.id !== vendorUserId);
  const isVendor = user && vendorUserId && user.id === vendorUserId;

  if (loading) {
    return <div className="text-center py-8">Loading ratings...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Rating Summary */}
      {stats && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
              {/* Average Rating */}
              <div className="flex items-center justify-center md:justify-start gap-4">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-primary">
                    {stats.average_rating.toFixed(1)}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 sm:h-5 sm:w-5 ${
                          star <= Math.round(stats.average_rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 mt-2">
                    Based on {stats.total_ratings} {stats.total_ratings === 1 ? 'rating' : 'ratings'}
                  </div>
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="flex-1">
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = stats.rating_distribution[star as keyof typeof stats.rating_distribution];
                    const percentage = stats.total_ratings > 0 
                      ? (count / stats.total_ratings) * 100 
                      : 0;
                    
                    return (
                      <div key={star} className="flex items-center gap-1 sm:gap-2">
                        <div className="flex items-center gap-1 w-16 sm:w-20">
                          <span className="text-xs sm:text-sm">{star}</span>
                          <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400" />
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs sm:text-sm text-gray-600 w-8 sm:w-12 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rating Form */}
      {!user ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-4 sm:p-6 text-center">
            <h3 className="text-base sm:text-lg font-semibold mb-2">Rate this Product</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please login to rate and review this product
            </p>
            <Button
              onClick={() => window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)}
              className="btn-primary"
            >
              Login to Rate
            </Button>
          </CardContent>
        </Card>
      ) : isVendor ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-4 sm:p-6 text-center">
            <h3 className="text-base sm:text-lg font-semibold mb-2">Rate this Product</h3>
            <p className="text-sm text-gray-600">
              You cannot rate your own products
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4 sm:p-6">
            {userRating && !editing ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold mb-2">Your Rating</h3>
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-5 w-5 sm:h-6 sm:w-6 ${
                            star <= userRating.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {userRating.review_text && (
                      <p className="text-sm text-gray-700 mt-2">{userRating.review_text}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(true)}
                      className="w-full sm:w-auto"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDeleteRating}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  {userRating ? 'Edit Your Rating' : 'Rate this Product'}
                </h3>
                
                {/* Star Rating */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="text-sm font-medium text-gray-700">Rating:</span>
                  <div className="flex items-center gap-1 sm:gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingForm({ ...ratingForm, rating: star })}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        onTouchStart={() => setHoveredStar(star)}
                        className="focus:outline-none touch-manipulation p-1"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Star
                          className={`h-7 w-7 sm:h-8 sm:w-8 transition-colors ${
                            star <= (hoveredStar || ratingForm.rating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {ratingForm.rating > 0 && (
                    <span className="text-sm font-medium text-gray-900">
                      {ratingForm.rating} {ratingForm.rating === 1 ? 'star' : 'stars'}
                    </span>
                  )}
                </div>

                {/* Review Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review (Optional)
                  </label>
                  <Textarea
                    value={ratingForm.review_text}
                    onChange={(e) => setRatingForm({ ...ratingForm, review_text: e.target.value })}
                    placeholder="Share your experience with this product..."
                    rows={4}
                    maxLength={2000}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {ratingForm.review_text.length}/2000 characters
                  </p>
                </div>

                {/* Submit Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    onClick={handleSubmitRating}
                    disabled={submitting || ratingForm.rating === 0}
                    className="btn-primary w-full sm:w-auto"
                    size="default"
                  >
                    {submitting ? 'Submitting...' : userRating ? 'Update Rating' : 'Submit Rating'}
                  </Button>
                  {editing && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(false);
                        setRatingForm({
                          rating: userRating?.rating || 0,
                          review_text: userRating?.review_text || ''
                        });
                      }}
                      className="w-full sm:w-auto"
                      size="default"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ratings List */}
      <div className="space-y-3 sm:space-y-4 w-full">
        <h3 className="text-base sm:text-lg font-semibold">
          Customer Reviews ({stats?.total_ratings || 0})
        </h3>
        
        {ratings.length === 0 ? (
          <Card>
            <CardContent className="p-4 sm:p-6 text-center text-gray-500">
              No ratings yet. Be the first to rate this product!
            </CardContent>
          </Card>
        ) : (
          <>
            {ratings.map((rating) => (
              <Card key={rating.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{rating.user_name}</span>
                        {rating.is_verified_purchase && (
                          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            <Check className="h-3 w-3" />
                            Verified Purchase
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= rating.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      {rating.review_text && (
                        <p className="text-sm text-gray-700 mb-2">{rating.review_text}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(rating.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProductRatings;

