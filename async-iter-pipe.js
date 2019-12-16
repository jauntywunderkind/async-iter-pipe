"use module"
import Defer from "p-defer"
import Delay from "delay"
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

export class AsyncIterPipe{
	static get [ Symbol.species](){
		return Promise
	}
	static get Closing(){
		return Closing
	}
	static get controllerSignals(){ return controllerSignals}
	static get listenerBinding(){ return listenerBinding}

	// state
	done= false
	value= undefined
	reads= new Dequeue() // reads from consumers pending new values
	writes= new Dequeue() // writes from push awaiting readers

	readCount= 0
	writeCount= 0

	// mode which is false
	//strictAsync= false

	constructor( opts){
		this.push= this.push.bind( this)
		if( opts){
			if( opts.controller){
				this.signal= opts.controller.signal
			}
			if( opts.strictAsync){
				this.strictAsync= true
			}
			if( opts.map){
				this.map= opts.map
			}
		}
	}

	next(){
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
	get queueCount(){
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
	push( value){
		// first check- still going?
		if( this.done){
			return t		}
		// sync-hronize
		if( value.then){
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

	_end( opts){
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
	return( value){
		if( this.closing){
			return 
		}
		this.done= true
		this.closing= Closing.return
		this.returnedValue= value
		this._end()
		return Promise.resolve({ done: true, value})
	}
	/**
	* Resolve done any outstanding reads, become done, and throw
	*/
	throw( ex){
		if( this.closing){
			return
		}
		this.done= true
		this.closing= Closing.throw
		this.thrownException= ex
		this._end()
		return Promise.reject( ex)
	}
	/**
	* Continue to allow pushes, and do not signal done until 
	*/
	drain( value){
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
	* Throw an abort to any outstanding reads, delay, & become done
	*/
	abort( ex){
		if( this.closing){
			return
		}
		if(!( ex instanceof AsyncIterPipeAbortError)){
			ex= new AsyncIterPipeAbortError( this, ex)
		}
		this.done= true
		this.aborted= true
		this.abortedException= ex

		// outstanding reads get thrown
		while( this.reads.length){
			const read= this.reads.shift()
			read.reject( ex)
		}
		this._end({ abort: ex})
	}

	[ Symbol.asyncIterator](){
		return this
	}

	// signal for when everything finishes
	thenDone( ok, fail){
		let doneSignal= this[ _doneSignal]
		if( !doneSignal){
			if( this.done){
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
	get controller(){
		return this[ _controller]
	}
	set controller( controller){
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
}
export {
	AsyncIterPipe as default,
	AsyncIterPipe as asyncIterPipe,
	AsyncIterPipe as Pipe,
	AsyncIterPipe as pipe
}
