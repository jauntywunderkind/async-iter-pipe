"use module"
import Defer from "p-defer"
import Dequeue from "dequeue"

export function AsyncIterPipeError( asyncIterPipe, err, msg= "AsyncIterPipeError"){
	Error.call( this, msg, err)
	this.asyncIterPipe= asyncIterPipe
}
AsyncIterPipeError.prototype = Object.create( Error.prototype)
AsyncIterPipeError.prototype.constructor = AsyncIterPipeError

export function AsyncIterPipeAbortError( asyncIterPipe, err, msg= "AsyncIterPipeAbortError"){
	AsyncIterPipeError.call( asyncIterPipe, err, msg)
}
AsyncIterPipeAbortError.prototype = Object.create( AsyncIterPipeError.prototype)
AsyncIterPipeAbortError.prototype.constructor = AsyncIterPipeAbortError

export function AsyncIterPipeDoneError( asyncIterPipe, err, msg= "AsyncIterPipeDoneError"){
	AsyncIterPipeError.call( asyncIterPipe, err, msg)
}
AsyncIterPipeDoneError.prototype = Object.create( AsyncIterPipeError.prototype)
AsyncIterPipeDoneError.prototype.constructor = AsyncIterPipeDoneError

export {
	AsyncIterPipeError as PipeError,
	AsyncIterPipeAbortError as PipeAbortError,
	AsyncIterPipeDoneError as PipeDoneError
}

const resolved= Promise.resolve()

// internal symbols
export const
	_controller= Symbol.for( "async-iter-pipe:_controller"),
	_doneSignal= Symbol.for( "async-iter-pipe:_doneSignal")

export const controllerSignals= [
	{name: "abort", test: "aborted"}
]

export const listenerBinding= {
	passive: true,
	once: true
}

function _done(){
	return {
		done: true,
		value: undefined
	}
}

export const Closing= {
	"return": 1,
	"throw": 2,
	abort: 3,
	drained: 4,
	draining: 5,
}

function value( name, opt, def){
	const value= opt&& opt[ name]|| def
	if( value){
		return {
			[ name]: {
				value,
				writable: true
			}
		}
	}
}

export function AsyncIterPipe( opt){
	this.done= false
	this.value= opt&& opt.value|| undefined
	Object.defineProperties( this, {
		...value( "signal", opt),
		...value( "strictAsync", opt, false),
		...value( "map", opt),
		// reads from consumers pending new values
		...value( "reads", opt, new Dequeue()),
		// writes from push awaiting readers
		...value( "writes", opt, new Dequeue()),
		...value( "readCount", opt, 0),
		...value( "writeCount", opt, 0),
		push: {
			value: this.push.bind( this),
			writable: true
		}
	})
	return this
}
export {
	AsyncIterPipe as default,
	AsyncIterPipe as asyncIterPipe,
	AsyncIterPipe as Pipe,
	AsyncIterPipe as pipe
}
Object.defineProperties( AsyncIterPipe, {
	[ Symbol.species]: {
		value: Promise
	},
	Closing: {
		value: Closing
	},
	controllerSignals: {
		value: controllerSignals
	},
	listenerBinding: {
		value: listenerBinding
	}
})

function next(){
	// if we're done nothing more happens
	if( this.done){
		if( this.draining){
			return this.draining.then( _done)
		}else{
			return _done()
		}
	}

	// so this read is happening
	++this.readCount

	// use already pushed writes
	let hadWrites= this.writes&& this.writes.length
	if( hadWrites){
		const
		  value= this.value= this.writes.shift(),
		  iter= { done: false, value}
		return this.strictAysync? Promise.resolve( iter): iter
	}

	// queue up a new pending read
	let pending= Defer()
	this.reads.push( pending)
	return pending.promise
}

/**
* Return number of stored write values ready to consume,
* or if negative, the number of read values pending
*/
function queueCount(){
	if( this.writes&& this.writes.length){
		return this.writes.length
	}else if( this.reads&& this.reads.length){
		return -this.reads.length
	}else{
		return 0
	}
}

/**
* Resolve a value, then provide it to a pending reade, or queue it as a apending write
*/
function push( value){
	// first check- still going?
	if( this.done){
		return t
	}
	// sync-hronize
	if( value&& value.then){
		value.then( this.push)
		return
	}
	++this.writeCount

	if( this.reads&& this.reads.length> 0){
		this.value= value
		const read= this.reads.shift()
		read.resolve({ done: false, value})

		if( this.draining&& this.reads.length=== 0){
			if( this.draining.resolve){
				this.draining.resolve()
			}
			if( this[ _doneSignal]){
				this[ _doneSignal].resolve()
			}
		}
	}else if( this.writes){
		// value is already synchronous, since we've sync-hronized above
		this.writes.push( value)
	}else{
		throw new Error("Cannot push: no read or write")
	}
}

function pull( iterable){
	let done= false
	// user can end with cancel
	function cancel(){
		done= true
	}
	// or pipe can go done
	this.doneSignal.then( function(){ done= true})

	// start read loop
	const loop= (async()=> {
		for await( let i of iterable){
			if( done){
				return
			}
			this.push( i)
		}
	})()
	loop.cancel= cancel
	return loop
}

function _end( opts){
	let first= true
	while( this.reads.length){
		const read= this.reads.shift()
		read.resolve({ done: true, value: first? this.returnedValue: undefined})
		first= false
	}
	this.writes.empty()

	// we're really finished, so signal as such
	let doneSignal= this[ _doneSignal]
	if( doneSignal&& doneSignal.resolve){
		if( opts&& opts.abort){
			doneSignal.reject( opts.abort)
		}else{
			doneSignal.resolve()
		}
	}
}

/**
* Resolve done any outstanding reads, become done
*/
const return_= { return: function( value){
	if( this.closing){
		return 
	}
	this.done= true
	this.closing= Closing.return
	this.returnedValue= value
	this._end()
	return Promise.resolve({ done: true, value})
}}.return

/**
* Resolve done any outstanding reads, become done, and throw
*/
const throw_= { throw: function( ex){
	if( this.closing){
		return
	}
	this.done= true
	this.closing= Closing.throw
	this.thrownException= ex
	this._end()
	return Promise.reject( ex)
}}.throw

/**
* Continue to allow pushes, and do not signal done until 
*/
function drain( value){
	if( this.closing){
		return
	}
	this.done= true
	this.drainedValue= value
	if( this.reads.length=== 0){
		// no pending reads to fulfill, so close now
		this.closing= Closing.drain
		this._end()
		return Promise.resolve()
	}else{
		this.closing= Closing.draining
		this.draining= Defer()
		this.draining.promise= this.draining.promise.then(()=> {
			this.closing= Closing.drain
			delete this.draining
			this._end()
		})
		return this.draining.promise
	}
}

/**
* whether pushed values are accepted
*/
function accepting(){
	const closing= this.closing
	return !closing|| closing=== Closing.drain
}

/**
* Throw an abort to any outstanding reads, delay, & become done
*/
function abort( ex){
	if( this.closing){
		return
	}
	if(!( ex instanceof AsyncIterPipeAbortError)){
		ex= new AsyncIterPipeAbortError( this, ex)
	}
	this.done= true
	this.closing= Closing.abort
	this.abortedException= ex

	// outstanding reads get thrown
	while( this.reads.length){
		const read= this.reads.shift()
		read.reject( ex)
	}
	this._end({ abort: ex})
}

// signal for when everything finishes
function thenDone( ok, fail){
	let doneSignal= this[ _doneSignal]
	if( !doneSignal){
		if( this.closing=== Closing.abort){
			doneSignal= { promise: Promise.reject( this.abortedException)}
		}else if( this.done){
			doneSignal= { promise: Promise.resolve()}
		}else{
			doneSignal= Defer()
		}
		this[ _doneSignal]= doneSignal
	}
	if( ok|| fail){
		return doneSignal.promise.then( ok, fail)
	}
	return doneSignal.promise
}
function getController(){
	return this[ _controller]
}
function setController( controller){
	const oldController= this[ _controller]
	if( controller== oldController){
		return
	}
	for( const signal of (this.controllerSignals|| this.constructor.controllerSignals)){
		// get our listener
		const
		  listenerName= signal.name,
		  binding= signal.binding|| (this.listenerBinding|| this.constructor.listenerBinding)
		let listener= this[ listenerName]
		if( !listener){
			continue
		}
		// insure listener is bound
		if( listener=== this.constructor.prototype[ listenerName]){
			listener= this[ listenerName]= listener.bind( this)
		}
		// stop listening for old signals
		if( oldController){
			oldController.removeEventListener( signal, listener, binding)
		}
		// listen for signals
		if( controller){
			controller.addEventListener( signal, listener, binding)
		}
		// controller might already have signalled
		if( controller[ signal.test]){
			listener()
		}
	}
}

Object.defineProperties( AsyncIterPipe.prototype, {
	next: {
		value: next
	},
	queueCount: {
		get: queueCount
	},
	push: {
		value: push
	},
	pull: {
		value: pull
	},
	_end: {
		value: _end
	},
	return: {
		value: return_
	},
	throw: {
		value: throw_
	},
	drain: {
		value: drain
	},
	accepting: {
		get: accepting
	},
	abort: {
		value: abort
	},
	thenDone: {
		value: thenDone
	},
	controller: {
		get: getController,
		set: setController
	},
	[ Symbol.asyncIterator]: {
		value: function(){
			return this
		}
	}
})
