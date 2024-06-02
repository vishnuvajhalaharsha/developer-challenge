// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// Define the ReviewStorage contract
contract ReviewStorage {
    // Define a structure to represent a review
    struct Review {
        uint256 rating; // The rating given to the movie
        string review;  // The textual review
        address reviewer; // The address of the reviewer
    }

    mapping(string => mapping(address => bool)) public hasReviewed; // {1223=>{0x12344=>true/false}}

    mapping(string => Review[]) public movieReviews; // movieId -> reviews

    // Event that will be emitted when a review is added
    event ReviewAdded(address indexed reviewer, string movieId, uint256 rating, string review);

    // Function to add a review
    function addReview(string memory movieId, uint256 rating, string memory review) public {
        // Ensure that the user has not already reviewed this movie
        require(!hasReviewed[movieId][msg.sender], "User has already reviewed this movie");

        // Create a new Review instance
        Review memory newReview = Review({
            rating: rating,
            review: review,
            reviewer: msg.sender
        });

        // Add the review to the movieReviews mapping
        movieReviews[movieId].push(newReview);
        // Mark the user as having reviewed this movie
        hasReviewed[movieId][msg.sender] = true;

        // Emit the ReviewAdded event
        emit ReviewAdded(msg.sender, movieId, rating, review);
    }

    // Function to get all reviews for a specific movie
    function getReviews(string memory movieId) public view returns (Review[] memory) {
        return movieReviews[movieId];
    }
}
