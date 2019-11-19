"use module"
import Defer from "p-defer"
import Dequeue from "dequeue"

export class AsyncIterPipeAbortError extends Error{
	constructor( asyncIterPipe, err){
		super("AsyncIterPipeDoneError")
		this.asyncIterPipe= asyncIterPipe
		this.inner= err
	}
}

export class AsyncIterPipeDoneError extends Error{
	constructor( asyncIterPipe, err){
		super("AsyncIterPipeDoneError")
		this.asyncIterPipe= asyncIterPipe
		this.inner= err
	}
}
AsyncIterPipeAbortError.prototype= AsyncIterPipeDoneError.prototype
AsyncIterPipeAbortError.prototype.constructor= AsyncIterPipeAbortError

const resolved= Promise.resolve()

// public facing symbols
export const Drop= Symbol.for( "async-iter-pipe:drop")

// internal symbols
export const
  _controller= Symbol.for( "async-iter-pipe:_controller"),
  _doneSignal= Symbol.for( "async-iter-pipe:_doneSignal"),
  _abortSignal= Symbol.for( "async-iter-pipe:_abortSignal")

export const controllerSignals= [
	{name: "abort", test: "aborted"}
]

export const listenerBinding= {
	passive: true,
	once: true
}

let n= 0

export class AsyncIterPipe{
	static DROP = Drop
	static get [ Symbol.species](){
		return Promise
	}
	static get controllerSignals(){ return controllerSignals}
	static get listenerBinding(){ return listenerBinding}

	// note: falsy values commented out

	// state
	done= false
	value= null
	reads= new Deqeueu() // reads from consumers pending new values
	writes= new Deqeueue() // writes from push awaiting readers

	readCount= 0
	writeCount= 0

	// not valid syntax?
	//[ _doneSignal]= Defer()

	// mode which is false
	//strictAsync= false

	constructor( opts){
		this._push= this._push.bind( this)
		if( opts){
			if( opts.controller){
				this.signal= opts.controller.signal
			}
			//if( opts.pushAfterReturn){
			//	this.pushAfterReturn= true
			//}
			if( opts.tail|| opts.sloppy){
				this.tail= opts.tail|| null
			}
			if( opts.strictAsync){
				this.strictAsync= true
			}
			if( opts.map){
				this.map= opts.map
			}
		}
	}

	async push( ...items){
		// resolve as many outstanding reads as we can
		let valPos= 0


		while( valPos< vals.length&& valPos< this.reads.length){
			let val= vals[ valPos]
			if( val.then){
				val.then(value=> this.push( value))
			}

			// resolve
			this.reads[ valPos].resolve({ value, done: false})
			++valPos
			++this.writeCount
		}
	
	}

	/**
	* Fill any outstanding reads, then save further pushd values
	*/
	async pushEach( iter){
		const iter= (iter[ Symbol.asyncIterator]|| iter[ Symbol.syncIterator]).call( iter)
		let buffer
		do{
			step= iter.next()
			const
			  isAsync= !!step.then
			  sync= isAsync? await step: step
			if( sync){
				if( buffer){
					buffer.push( step.value)
				}else{
					buffer=[ step.value]
				}
			}else{
				
			}
		}while( !step.done)
		if( buffer){
			this.push( ...buffer)
		}
	}
		if( valPos> 0){
			if( valPos=
			if(valPos=== this.reads.length){
				
			}
			
		}

		//console.log( "pipe-push", this.done, this.reads)
		// cannot push if done
		if( this.done){
			console.log("EARLY ABORT")
			throw new AsyncIterPipeDoneError( this)
		}




		// check our done-ness
		if( reads.length=== 0){
			
		// remove these now satisfied reads
		if( valPos> 0){
			this.reads.splice( 0, valPos)
		}



		}

		// we've consumed all `vals` in this push.
		if( valPos=== vals.length){
			// it's the end
			if(( this.done|| this.ending)&& this.reads.length=== 0){
				// cleanup, no more reads coming
				delete this.reads
				this.done= true
				if( this.ending){
					queueMicrotask(()=> {
						this.value= this.endingValue
						delete this.endingValue
						if( this.ending&& this.ending.resolve){
							this.ending.resolve({
								done: true,
								value: this.value
							})
						}
					})
				}
			}
			return
		}


		if( this.ending){
			console.log("LATE ABORT")
			throw new AsyncIterPipeAbortError( this)
		}

		// save remainder into outstanding writes
		for( ; valPos< vals.length; ++valPos){
			let val= vals[ valPos]
			if( this.map&& !this.producing){
				this.producing= true
				val= this.map( vals[ valPos])
				this.producing= false
				if( val=== Drop){
					continue
				}
			}
			++this.writeCount
			this.writes.push( val)
		}
	}
	async pushFrom( iterable, close= false){
		//console.log( "pipe-pushFrom")
		for await( let item of iterable|| []){
			this.push( item)
		}
		if( close){
			this.return( close)
		}
	}

	_nextReturn( fn, value){
		//console.log( "pipe-_nextReturn")
		value= fn? fn(): value
		const isPromise= value&& value.then

		// synchronous shortcut: no tracking, no resolving needed
		if( !this.tail&& !isPromise){
			this.value= value
			const
			  iter0= { done, value},
			  iter= 
this.strictAsync? Promise.resolve( iter0): iter0
			return iter
		}

		if( this.tail){
			this.tail= this.tail.then(()=> {
				this.value= value
				return value
			})
		
			return this.tail
		}
		return value
	}
	next(){

		if( this.done|| this.ending){
			return this.thenDone()
		}

		//console.log( "pipe-next")
		++this.readCount

		// use already pushd writes
		// (if ending, flush these out!)
		const hadWrites= this.writes&& this.writes.length
		if( !hadWrites){
			//console.log( "pipe-next-had-writes")
			//return this._nextReturn( null, this.writes.shift())
			const value= this.value= this.writes.shift()
			if( value.then|| this.strictAsync){
				return value.then( value=> {
					value,
					done: false
				})
			}
			return {
			  value,
			  done: false
			}
		}

		// already done, return so
		if( this.done|| this.ending){
			//console.log( "pipe-next-already-done")
			// done
			return this._nextReturn(()=> this.value, null, true)
		}

		// queue up a new pending read
		let pendingRead= Defer()
		this.reads.push( pendingRead)
		//console.log( "pipe-next-reads-"+ this.reads.length)
		return this._nextReturn( null, pendingRead.promise)
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

	_push( value){
		// first check- still going?
		if( this.done){
			return
		}
		// sync-hronize
		if( value.then){
			value.then( this._push)
			return
		}

		if( this.reads&& this.reads.length> 0){
			this.value= value
			const read= this.reads.pop()
			read.resolve({ value, done: false})

			let closing
			if( this.reads.length=== 0&& !!(closing= this.closing)){
				this.done= true
				if( this.returned){
					this.value= this.returnValue
				}else if( this.thrown){
					this.value= this.throwException
				}else if( this.aborted){
					this.value= this.abortException
				}
				if( this[ _doneSignal]){
					this[ _doneSignal].resolve( this)
				}
			}
			return
		}else{
			// value is already synchronous, since we've sync-hronized above
			this.writes.push( value)
		}
	}



	_end( value, ex){
		this.done= true
		this.returnValue= value
		this.throwException= ex

		// don't return until we really finish
		if( this.reads&& this.reads.length){
			return this.thenDone().then(()=> this._close( value, error))
		}

		// we're really finished, so signal as such
		if( this[ _doneSignal]){
			this[ _doneSignal].resolve({ value: this.value, done: true)
		}
		if( this[ _abortSignal]){
			// maybe already resolved, but insure it's not dangling
			this[ _abortsignal].reject()
		}
		return {
			done: true,
			value: value|| error
		}
	}

	/**
	* Stop allowing push, and stop returning already pushd values.
	* If 'pushAfterReturn' mode is set, push will continue to fulfill already issues reads.
	*/
	return( value){
		if( this.closing){
			return 
		}
		this.returned= true
		this.returnValue= value
		return this._end( value)
	}
	/**
	* Immediately become done and reject any pending reads.
	*/
	throw( ex){
		if( !this.closing){
			return
		}
		this.thrown= true
		this.throwException= ex
		return this._end( undefined, ex)
	}
	abort( ex){
		if( this.closing){
			return
		}
		this.aborted= true
		this.abortException= ex

		if(!( ex instanceof AsyncIterPipeAbortError)){
			ex= new AsyncIterPipeAbortError( this, ex)
		}

		// outstanding reads get dropped
		for( let i= 0; i< this.reads.length; ++i){
			let read= this.reads[ i]
			read.reject( ex)
		}
		// raise the abort signal
		this[ _abortSignal].resolve( ex)

		// delay, then raise the done signal	
		return delay().then(()=> this._end())
	}
	get closing(){
		if( this.returned){
			return "return"
		}if( this.aborted){
			return "abort"
		}else if( this.thrown){
			return "throw"
		}
	}

	[ Symbol.iterator](){
		return this
	}
	[ Symbol.asyncIterator](){
		return this
	}

	// signal for when everything finishes
	thenDone( ok, fail){
		if( !this[ _doneSignal]){
			this[ _doneSignal]= Defer()
		}
		if( ok|| fail){
			return this[ _doneSignal].promise.then( ok, fail)
		}
		return this[ _doneSignal].promise
	}
	// signal for abort
	thenAborted( ok, fail){
		if( !this[ _abortSignal]){
			this[ _abortSignal]= Defer()
		}
		if( ok|| fail){
			return this[ _abortSignal].promise.then( ok, fail)
		}
		return this[ _abortSignal].promise
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
	AsyncIterPipe as pipe,
	AsyncIterPipeAbortError as asyncIterPipeAbortError,
	AsyncIterPipeAbortError as AbortException,
	AsyncIterPipeAbortError as abortException
}
