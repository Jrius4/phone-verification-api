const Joi = require('joi');
const ProductLot = require('../models/ProductLot');
const ProductBid = require('../models/ProductBid');
const DeliveryRequest = require('../models/DeliveryRequest');
const PaymentIntent = require('../models/PaymentIntent');
const { PaymentService } = require('../utils/payments');

const placeSchema = Joi.object({ name: Joi.string().allow('', null), address: Joi.string().allow('', null), lat: Joi.number().required(), lng: Joi.number().required() });

exports.createLot = async (req, res) => {
    try {
        const schema = Joi.object({ produceType: Joi.string().required(), quantity: Joi.number().positive().required(),description:Joi.string().allow('', null), unit: Joi.string().valid('Kg', 'Bags','Trays', 'Crates', 'Litres', 'Tonnes').default('Kg'), reservePrice: Joi.number().min(0).default(0), pickup: placeSchema.required() });
        const body = await schema.validateAsync(req.body);
        const doc = await ProductLot.create({ ...body, farmerId: req.user._id });
        try { req.io?.emit('product:new', { lotId: doc._id.toString() }); } catch { }
        res.status(201).json({ id: doc._id, status: doc.status });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: e.message || 'Server error' });
    }
};

exports.openLots = async (_req, res) => {
    const rows = await ProductLot.find({ status: 'open' }).sort({ createdAt: -1 }).lean();
    res.json({ data: rows });
};

exports.placeBid = async (req, res) => {
    try{
        const schema = Joi.object({ amount: Joi.number().positive().required(),quantity: Joi.number().positive().required(),units: Joi.string().allow('', null), note: Joi.string().allow('', null) });
    const { amount,quantity,units, note } = await schema.validateAsync(req.body);
    const lot = await ProductLot.findById(req.params.id);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });
    if (lot.status !== 'open') return res.status(400).json({ message: 'Lot not open' });
    const bid = await ProductBid.create({ lotId: lot._id, buyerId: req.user.sub, amount, note,quantity,units });
    try { req.io?.emit('product:bid', { lotId: lot._id.toString(), bidId: bid._id.toString() }); } catch { }
    res.status(201).json({ bidId: bid._id });
    } catch(e){
        res.status(500).json({success:false,message:e.message || 'Something Happen'})
    }
};

exports.listBids = async (req, res) => {
    const lot = await ProductLot.findById(req.params.id);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });
    if (String(lot.farmerId) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const bids = await ProductBid.find({ lotId: lot._id, status: { $in: ['pending', 'accepted'] } }).populate('buyerId', 'firstName lastName email').sort({ amount: -1 }).lean();
    res.json({ bids });
};

exports.acceptBid = async (req, res) => {
    try{
        const lot = await ProductLot.findById(req.params.id);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });
    if (String(lot.farmerId) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    
    const bid = await ProductBid.findOne({ _id: req.params.bidId, lotId: lot._id,status:'pending' }).populate('buyerId');
    console.log({bid});
    if (!bid) return res.status(404).json({ message: 'Bid not found or not pending' });

    bid.status = 'accepted'; await bid.save();
    // if(lot.quantity > bid.amount){
    //     let qtyReminding = lot.quantity - bid.amount;
    //     lot.quantity = (qtyReminding + 45000)
    // }else{
    //     console.error('bid amount is more')
    // }
    // await ProductBid.updateMany({ lotId: lot._id, _id: { $ne: bid._id }, status: 'pending' }, { $set: { status: 'accepted' } });
    await lot.save();

    const prov = await PaymentService.authorize({ job: { _id: lot._id, payment_amount: bid.amount }, buyer: bid.buyerId._id });
    await PaymentIntent.create({ jobId: lot._id, buyerId: bid.buyerId._id, driverId: null, amount: bid.amount, status: 'authorized', provider: prov.provider, providerRef: prov.providerRef, type: 'product' });

    // Seed a DeliveryRequest for the buyer to broadcast (pickup = farm)
    const dr = await DeliveryRequest.create({
        buyerId: bid.buyerId._id,
        farmerId: lot.farmerId,
        produceType: lot.produceType,
        quantity: lot.quantity,
        unit: lot.unit,
        pickup: lot.pickup,
        dropoff: { name: '', address: '', lat: 0, lng: 0 },
        notes: `From lot ${lot._id}`,
        lotId: lot._id,
        productBidId:bid._id,
        pickupOwnerId: lot.farmerId,
        status: 'open',
    });
    try { req.io?.emit('sale:accepted', { lotId: lot._id.toString(), buyerId: bid.buyerId._id.toString() }); } catch { }
    try { req.io?.emit('request:new', { requestId: dr._id.toString() }); } catch { }

    res.json({ requestId: dr._id });
    }catch(e){
        console.log('farmer accepts bid:',{e})
        res.status(500).json({message:e.message || 'Something Happened'})
    }
};