import mongoose, { Document, Schema } from 'mongoose';

export interface IRatings extends Document {
  ethId: string;
  movieId: string;
  rating: string;
  review:string;
  blockchainTxId: string
}

const RatingsSchema: Schema = new Schema({
  ethId: { type: String, required: true },
  movieId: { type: String, required: true },
  rating: { type: String, required: true},
  review :{ type: String , required: true},
  blockchainTxId: {type: String},
 
});
RatingsSchema.index({ ethId: 1, movieId: 1 }, { unique: true });


export default mongoose.model<IRatings>('Rating', RatingsSchema);
